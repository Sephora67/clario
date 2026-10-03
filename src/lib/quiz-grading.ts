export type QuizKey = { correctIndex: number; acceptedAnswers: string[]; explanation: string };

export const normalizeQuizAnswer = (value: string) => value
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export function gradeQuizResponse(key: QuizKey, choiceIndex: number, text: string): boolean {
  if (choiceIndex !== key.correctIndex) return false;
  if (key.correctIndex !== 4) return true;
  const typed = normalizeQuizAnswer(text);
  if (typed.length < 2) return false;
  return key.acceptedAnswers.some((answer) => {
    const accepted = normalizeQuizAnswer(answer);
    return typed === accepted || typed.includes(accepted) || accepted.includes(typed);
  });
}
