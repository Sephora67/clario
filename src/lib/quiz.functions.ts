import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { PageQuizData, QuizAnswer, QuizQuestion } from "./quiz-types";
import { createPageQuiz } from "./quiz-generation.server";
import { gradeQuizResponse, type QuizKey } from "./quiz-grading";

const inputSchema = z.object({ documentId: z.string().uuid(), page: z.number().int().min(0) });
const answerSchema = z.object({ quizId: z.string().uuid(), questionIndex: z.number().int().min(0).max(4), choiceIndex: z.number().int().min(0).max(4), text: z.string().max(300) });

type QuizRow = { id: string; document_id: string; page: number; title: string; questions: Json; answers: Json; score: number | null; completed_at: string | null; created_at: string };
type SecretAnswer = QuizKey;

function distributeQuizAnswers(generated: Awaited<ReturnType<typeof createPageQuiz>>) {
  const regular = generated.questions.filter((question) => !question.noneIsCorrect);
  const targets = new Map(regular.map((question, index) => [question, index % 4]));
  return generated.questions.map((question) => {
    if (question.noneIsCorrect) return question;
    const target = targets.get(question) ?? 0;
    const options = [...question.options];
    const [correct] = options.splice(question.correctIndex, 1);
    if (correct === undefined) return question;
    options.splice(target, 0, correct);
    return { ...question, options, correctIndex: target };
  });
}

function quizDto(row: QuizRow): PageQuizData {
  return {
    id: row.id,
    documentId: row.document_id,
    page: row.page,
    title: row.title,
    questions: row.questions as unknown as QuizQuestion[],
    answers: row.answers as unknown as QuizAnswer[],
    score: row.score,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export const getPageQuiz = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<PageQuizData | null> => {
    const { data: row, error } = await context.supabase.from("page_quizzes").select("id,document_id,page,title,questions,answers,score,completed_at,created_at").eq("document_id", data.documentId).eq("page", data.page).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return row ? quizDto(row as QuizRow) : null;
  });

export const generatePageQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.extend({ title: z.string().min(1).max(200), image: z.string().min(100).max(8_000_000), locale: z.enum(["en", "fr"]) }).parse(data))
  .handler(async ({ data, context }): Promise<PageQuizData> => {
    const fr = data.locale === "fr";
    const { data: doc } = await context.supabase.from("documents").select("id").eq("id", data.documentId).maybeSingle();
    if (!doc) throw new Error(fr ? "Document introuvable." : "Document not found.");
    const { data: allowed, error: rateError } = await context.supabase.rpc("check_chat_rate_limit");
    if (rateError || allowed !== true) throw new Error(fr ? "Trop de demandes d’un coup. Attends quelques secondes avant de relancer Clario." : "Too many requests at once. Wait a few seconds before trying again.");
    const { data: paid, error: creditError } = await context.supabase.rpc("consume_credit", { _kind: "question" });
    if (creditError || paid === 0) throw new Error(fr ? "Tu n’as plus de questions 💬." : "You're out of questions 💬.");
    if (paid === 2) throw new Error(fr ? "🏖️ Oula, doucement champion ! Tes crédits sont bien au chaud et t'appartiennent pour toujours, mais mes processeurs commencent à chauffer. Clario a besoin de vacances. Je vais aux Bahamas et je te reviens le mois prochain." : "🏖️ Whoa, easy there, champ! Your credits are safe and yours forever, but my processors are heating up. Clario is off to the Bahamas until next month!");
    const refund = async () => { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); await supabaseAdmin.rpc("refund_credit", { _uid: context.userId, _kind: "question" }); };
    try {
      const generated = await createPageQuiz(data.title, data.image, data.locale);
      if (generated.insufficient) throw new Error(fr ? "Cette page ne contient pas assez de matière lisible pour créer cinq bonnes questions." : "This page doesn't have enough readable material for five good questions.");
      const noneLabel = fr ? "Aucune de ces réponses" : "None of these answers";
      const balanced = distributeQuizAnswers(generated);
      const questions: QuizQuestion[] = balanced.map((question, index) => ({ id: `q${index + 1}`, prompt: question.prompt.slice(0, 500), options: [...question.options.map((option) => option.slice(0, 240)), noneLabel] }));
      const keys: SecretAnswer[] = balanced.map((question) => ({ correctIndex: question.noneIsCorrect ? 4 : question.correctIndex, acceptedAnswers: question.acceptedAnswers.map((answer) => answer.slice(0, 160)), explanation: question.explanation.slice(0, 600) }));
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin.from("page_quizzes").insert({ user_id: context.userId, document_id: data.documentId, page: data.page, title: generated.title.slice(0, 120), questions: questions as unknown as Json }).select("id,document_id,page,title,questions,answers,score,completed_at,created_at").single();
      if (error) throw error;
      const { error: keyError } = await supabaseAdmin.from("page_quiz_keys").insert({ quiz_id: row.id, answer_key: keys as unknown as Json });
      if (keyError) { await supabaseAdmin.from("page_quizzes").delete().eq("id", row.id); throw keyError; }
      return quizDto(row as QuizRow);
    } catch (error) {
      await refund().catch((refundError) => console.error("quiz refund failed", refundError));
      const message = error instanceof Error ? error.message : "";
      console.error("quiz generation failed", message);
      throw new Error(message || (fr ? "Clario n’a pas réussi à créer le quiz." : "Clario couldn't create the quiz."));
    }
  });

export const answerPageQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => answerSchema.parse(data))
  .handler(async ({ data, context }): Promise<PageQuizData> => {
    const { data: row, error } = await context.supabase.from("page_quizzes").select("id,document_id,page,title,questions,answers,score,completed_at,created_at").eq("id", data.quizId).maybeSingle();
    if (error || !row) throw new Error("Quiz introuvable.");
    const answers = row.answers as unknown as QuizAnswer[];
    if (answers.some((answer) => answer.questionIndex === data.questionIndex)) return quizDto(row as QuizRow);
    if (data.questionIndex !== answers.length) throw new Error("Réponds aux questions dans l’ordre.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: keyRow } = await supabaseAdmin.from("page_quiz_keys").select("answer_key").eq("quiz_id", data.quizId).maybeSingle();
    const key = (keyRow?.answer_key as unknown as SecretAnswer[] | undefined)?.[data.questionIndex];
    if (!key) throw new Error("Correction introuvable.");
    const correct = gradeQuizResponse(key, data.choiceIndex, data.text);
    const next: QuizAnswer[] = [...answers, { questionIndex: data.questionIndex, choiceIndex: data.choiceIndex, text: data.text.trim(), correct, explanation: key.explanation }].sort((a, b) => a.questionIndex - b.questionIndex);
    const completed = next.length === 5;
    const score = completed ? next.filter((answer) => answer.correct).length : null;
    const completedAt = completed ? new Date().toISOString() : null;
    const { data: updated, error: updateError } = await supabaseAdmin.from("page_quizzes").update({ answers: next as unknown as Json, score, completed_at: completedAt, updated_at: new Date().toISOString() }).eq("id", data.quizId).eq("user_id", context.userId).select("id,document_id,page,title,questions,answers,score,completed_at,created_at").single();
    if (updateError) throw new Error(updateError.message);
    return quizDto(updated as QuizRow);
  });

export const restartPageQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ quizId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PageQuizData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("page_quizzes").update({ answers: [], score: null, completed_at: null, updated_at: new Date().toISOString() }).eq("id", data.quizId).eq("user_id", context.userId).select("id,document_id,page,title,questions,answers,score,completed_at,created_at").single();
    if (error) throw new Error(error.message);
    return quizDto(row as QuizRow);
  });
