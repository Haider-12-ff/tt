
export interface TranslationPair {
  en: string;
  ar: string;
}

export interface BilingualSegment {
  en: string;
  ar: string;
}

export interface ExamQuestion {
  question: TranslationPair;
  answer: TranslationPair;
  hint: TranslationPair;
}

export interface LectureSubSection {
  title: TranslationPair;
  // content is now an array of segments for word/phrase-by-phrase translation
  segments: BilingualSegment[];
  type: 'definition' | 'example' | 'concept';
  isImportant: boolean;
}

export interface LectureSection {
  id: string;
  title: TranslationPair;
  subSections: LectureSubSection[];
  examQuestions: ExamQuestion[];
}

export interface StructuredLecture {
  mainTitle: TranslationPair;
  overview: TranslationPair;
  sections: LectureSection[];
}
