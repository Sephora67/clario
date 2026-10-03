import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Check, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { currentLocale, tf } from "@/lib/i18n";
import { answerPageQuiz, generatePageQuiz, getPageQuiz, restartPageQuiz } from "@/lib/quiz.functions";
import type { PageQuizData } from "@/lib/quiz-types";
import { refreshCredits } from "@/hooks/use-credits";

export function PageQuiz({ documentId, page, title, image }: { documentId: string; page: number; title: string; image: string }) {
  const loadQuiz = useServerFn(getPageQuiz);
  const generateQuiz = useServerFn(generatePageQuiz);
  const answerQuiz = useServerFn(answerPageQuiz);
  const restartQuiz = useServerFn(restartPageQuiz);
  const [quiz, setQuiz] = useState<PageQuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState("");
  const [typed, setTyped] = useState("");
  const answered = quiz?.answers.length ?? 0;
  const current = quiz?.questions[answered];

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadQuiz({ data: { documentId, page } }).then((data) => { if (active) setQuiz(data); }).catch((error) => toast.error(error instanceof Error ? error.message : tf("Chargement du quiz impossible."))).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [documentId, page, loadQuiz]);

  const create = async () => {
    setBusy(true);
    try {
      const next = await generateQuiz({ data: { documentId, page, title, image, locale: currentLocale() } });
      setQuiz(next); setChoice(""); setTyped(""); refreshCredits();
    } catch (error) { toast.error(error instanceof Error ? error.message : tf("Création du quiz impossible.")); refreshCredits(); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!quiz || !current || choice === "") return;
    setBusy(true);
    try { const next = await answerQuiz({ data: { quizId: quiz.id, questionIndex: answered, choiceIndex: Number(choice), text: typed } }); setQuiz(next); setChoice(""); setTyped(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : tf("Correction impossible.")); }
    finally { setBusy(false); }
  };
  const restart = async () => {
    if (!quiz) return;
    setBusy(true);
    try { setQuiz(await restartQuiz({ data: { quizId: quiz.id } })); setChoice(""); setTyped(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : tf("Impossible de recommencer le quiz.")); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="grid flex-1 place-items-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />{tf("Chargement du quiz…")}</div>;
  if (!quiz) return <div className="flex flex-1 flex-col items-center justify-center px-5 text-center"><span className="grid size-14 place-items-center rounded-full bg-primary-soft text-amber-strong"><Brain /></span><h2 className="mt-4 font-display text-xl font-bold">{tf("Quiz de cette page")}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{tf("Clario créera 5 questions à partir de la page ouverte. Cela utilise 1 crédit-question.")}</p><Button className="mt-5" disabled={busy} onClick={() => void create()}>{busy ? <Loader2 className="animate-spin" /> : <Brain />}{tf("Créer mon quiz")}</Button></div>;
  if (!current) return <div className="flex flex-1 flex-col items-center justify-center px-5 text-center"><span className="grid size-14 place-items-center rounded-full bg-success-soft text-success-strong"><Check /></span><p className="mt-2 text-xs font-bold uppercase text-muted-foreground">{tf("Résultat")}</p><p className="mt-2 font-display text-4xl font-bold">{quiz.score ?? quiz.answers.filter((answer) => answer.correct).length} / 5</p><p className="mt-3 text-sm text-muted-foreground">{tf("Ton résultat est enregistré avec cette page.")}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button variant="outline" disabled={busy} onClick={() => void restart()}><RotateCcw />{tf("Recommencer sans repayer")}</Button><Button disabled={busy} onClick={() => void create()}>{busy ? <Loader2 className="animate-spin" /> : <Brain />}{tf("Nouveau quiz · 1 crédit")}</Button></div></div>;

  const previous = quiz.answers[quiz.answers.length - 1];
  return <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-amber-strong">{tf("Quiz de cette page")}</p><h2 className="font-display text-lg font-bold">{quiz.title}</h2></div><span className="text-sm font-semibold">{answered + 1}/5</span></div>
    <Progress value={(answered / 5) * 100} className="mt-3" />
    {previous && <div className={cn("mt-4 border p-3 text-sm", previous.correct ? "border-success bg-success-soft" : "border-destructive/40 bg-destructive/5")}><p className="flex items-center gap-2 font-semibold">{previous.correct ? <Check className="size-4 text-success-strong" /> : <X className="size-4 text-destructive" />}{previous.correct ? tf("Bonne réponse !") : tf("Pas tout à fait.")}</p><p className="mt-1 text-muted-foreground">{previous.explanation}</p></div>}
    <div className="mt-5"><p className="font-semibold leading-6">{current.prompt}</p><RadioGroup className="mt-4" value={choice} onValueChange={setChoice}>{current.options.map((option, index) => <label key={`${current.id}-${index}`} className={cn("grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border bg-card p-3 text-sm", choice === String(index) && "border-amber-strong bg-primary-soft")}><RadioGroupItem value={String(index)} className="mt-0.5" /><span><strong className="mr-1">{String.fromCharCode(65 + index)}.</strong>{option}</span></label>)}</RadioGroup>{choice === "4" && <Input className="mt-3" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={tf("Écris la bonne réponse…")} aria-label={tf("Ta réponse écrite")} />}</div>
    <Button className="mt-5 w-full" disabled={busy || choice === "" || (choice === "4" && typed.trim().length < 2)} onClick={() => void submit()}>{busy ? <Loader2 className="animate-spin" /> : null}{tf("Valider ma réponse")}</Button>
  </div>;
}