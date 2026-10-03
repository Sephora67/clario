export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export type QuizAnswer = {
  questionIndex: number;
  choiceIndex: number;
  text: string;
  correct: boolean;
  explanation: string;
};

export type PageQuizData = {
  id: string;
  documentId: string;
  page: number;
  title: string;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  score: number | null;
  completedAt: string | null;
  createdAt: string;
};
