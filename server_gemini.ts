import { GoogleGenAI, Type } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;
let useFallback = false;

// Lazy client provider
export function getGeminiClient(): GoogleGenAI | null {
  if (useFallback) return null;
  if (aiInstance) return aiInstance;

  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    console.warn('************************************************************************');
    console.warn('WARNING: GEMINI_API_KEY is not configured or is placeholder.');
    console.warn('Tutor AI will operate in Mock Fallback Mode smoothly.');
    console.warn('Please provide a real GEMINI_API_KEY in Settings/Secrets to enable Gemini.');
    console.warn('************************************************************************');
    useFallback = true;
    return null;
  }

  try {
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    return aiInstance;
  } catch (err) {
    console.error('Failed to initialize Google GenAI SDK, falling back to mock mode:', err);
    useFallback = true;
    return null;
  }
}

// 1. Generate Intelligent AI Summary, Vocab & Flashcards with Structured JSON Schema
export async function generateAcademicMetadata(noteTitle: string, noteContent: string): Promise<{
  summary: string;
  vocabulary: { term: string; definition: string }[];
  flashcards: { question: string; answer: string }[];
}> {
  const client = getGeminiClient();
  if (!client) {
    return generateMockAcademicMetadata(noteTitle, noteContent);
  }

  try {
    const prompt = `You are Tutor AI, an Elite Academic Success Co-Pilot.
    Analyze the following scientific or study note titled "${noteTitle}" and extract:
    1. A clear, highly concise academic summary (maximum 3 concise sentences).
    2. A vocabulary list of up to 4 key terms and their precise textbook definitions.
    3. A set of up to 4 interactive active recall flashcards matching this text material.
    
    Format the complete output as a valid JSON object matching the requested schema. Do not include markdown codeblocks around the raw JSON output.
    Text material:
    ${noteContent}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'Academic summary' },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING }
                },
                required: ['term', 'definition']
              }
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                },
                required: ['question', 'answer']
              }
            }
          },
          required: ['summary', 'vocabulary', 'flashcards']
        }
      }
    });

    const parsedText = response.text?.trim() || '';
    return JSON.parse(parsedText);
  } catch (err) {
    console.error('Gemini generateAcademicMetadata crashed, running safe fallback:', err);
    return generateMockAcademicMetadata(noteTitle, noteContent);
  }
}

// 2. Generate custom structured Practice Quizzes based on Academic Subjects or Notes
export async function generatePracticeExam(subjectName: string, noteTitle: string, noteContent: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<{
  title: string;
  questions: {
    id: string;
    type: 'mcq' | 'boolean' | 'short';
    question: string;
    options?: string[];
    correctAnswer: string;
  }[];
}> {
  const client = getGeminiClient();
  if (!client) {
    return generateMockPracticeExam(subjectName, noteTitle, noteContent, difficulty);
  }

  try {
    const prompt = `You are an Adaptive Exam Engine for "${subjectName}".
    Construct a complete practice quiz of exactly 3 custom premium academic exam questions on "${noteTitle}" with ${difficulty} difficulty.
    - Question 1 MUST be a Multiple-Choice Question (type: 'mcq') with exactly 4 distinct options and 1 correctAnswer.
    - Question 2 MUST be a True/False Question (type: 'boolean') with correct answer being either 'True' or 'False'.
    - Question 3 MUST be a Short Answer Question (type: 'short') with a single, highly clean phrase as the correctAnswer.
    
    The output MUST be a clean JSON object according to the schema. Clean questions and options from markdown characters.
    Material context:
    ${noteContent}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, description: "Must be 'mcq', 'boolean', or 'short'" },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING }
                },
                required: ['id', 'type', 'question', 'correctAnswer']
              }
            }
          },
          required: ['title', 'questions']
        }
      }
    });

    const parsedText = response.text?.trim() || '';
    return JSON.parse(parsedText);
  } catch (err) {
    console.error('Gemini generatePracticeExam crashed, running safe fallback:', err);
    return generateMockPracticeExam(subjectName, noteTitle, noteContent, difficulty);
  }
}

// 3. Generate study recommendations/planner tasks based on performance history
export async function generateStudyRecommendations(userHistory: string): Promise<string> {
  const client = getGeminiClient();
  if (!client) {
    return generateMockRecommendations();
  }

  try {
    const prompt = `Analyze this student academic progress history log: "${userHistory}".
    Generate 3 elegant, smart, and highly actionable bullet-pointed study recommendations for their Study Planner. Include clear, brief motivational tips. Keep responses in concise markdown form under 300 words.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });

    return response.text || generateMockRecommendations();
  } catch (err) {
    console.error('Gemini generateStudyRecommendations crashed, running safe fallback:', err);
    return generateMockRecommendations();
  }
}


/* --- SEAMLESS HIGH QUALITY ACADEMIC MOCK FALLBACKS --- */

function generateMockAcademicMetadata(title: string, content: string) {
  console.log(`[Mock Mode] Generating academic data for note: ${title}`);
  const keywords = content.toLowerCase().split(/\W+/).filter(w => w.length > 5);
  
  const vocabTerm1 = keywords[0] ? capitalize(keywords[0]) : 'Academic Synthesis';
  const vocabTerm2 = keywords[1] ? capitalize(keywords[1]) : 'Cognitive Consolidation';
  const vocabTerm3 = keywords[2] ? capitalize(keywords[2]) : 'Recall Paradigm';

  return {
    summary: `Your Intelligent Co-Pilot generated this summary of "${title}". This note focuses on expanding structural comprehension and retention, illustrating core subject properties, procedural workflows, and educational foundations. Direct practice via active recall is recommended.`,
    vocabulary: [
      { term: vocabTerm1, definition: `The foundational system mapping critical factors, properties, and conceptual definitions within ${title}.` },
      { term: vocabTerm2, definition: `The neuro-educational process converting sensory lectures into structured long-term memory configurations.` },
      { term: vocabTerm3, definition: `The study process of retrieving academic terms without relying on textbooks, which strengthens neural connections.` }
    ],
    flashcards: [
      { question: `What is the core emphasis in "${title}"?`, answer: `To analyze and capture key properties, workflows, and definitions to streamline academic mastery.` },
      { question: `Why is the study of ${vocabTerm1} key for students?`, answer: `It acts as the structural baseline for solving complex questions and planning syllabus reviews.` },
      { question: `How can active recall be applied to "${vocabTerm2}"?`, answer: `By reviewing flashcard parameters systematically rather than passively rereading the syllabus.` }
    ]
  };
}

function generateMockPracticeExam(subject: string, noteTitle: string, noteContent: string, difficulty: string) {
  console.log(`[Mock Mode] Generating mock practice quiz for note: ${noteTitle} (${difficulty})`);
  return {
    title: `Adaptive ${subject}: ${noteTitle} - Core Review`,
    questions: [
      {
        id: 'mock_q_1',
        type: 'mcq' as const,
        question: `Based on your material, what is the most scientifically robust way to test your understanding?`,
        options: [
          'Passively highlighting paragraphs with color marker pens',
          'Active recall and spaced repetition practice',
          'Rereading the same textbook pages multiple times consecutively',
          'Leaving revision notes untouched until the day of the examination'
        ],
        correctAnswer: 'Active recall and spaced repetition practice'
      },
      {
        id: 'mock_q_2',
        type: 'boolean' as const,
        question: `True or False: Research demonstrates that spaced repetition is less efficient than learning a large syllabus in one single session.`,
        correctAnswer: 'False'
      },
      {
        id: 'mock_q_3',
        type: 'short' as const,
        question: `What name is given to the Tutor AI feature that generates practice flashcards automatically?`,
        correctAnswer: 'Intelligent Companion'
      }
    ]
  };
}

function generateMockRecommendations(): string {
  return `### 💡 Smart Academic Recommendations:
* **Target Difficult Subjects First**: Allocate your upcoming 25-minute study intervals to Calculus and Quantum Mechanics, utilizing the newly generated flashcards.
* **Capitalize on Active Recall**: You have taken 1 quiz today! Complete 1 more MCQ exam on 'Generative Models' inside the *Practice Arena* to secure a daily streak.
* **Keep Planner Milestones Clear**: Break down the 'Solve Derivative Set' task into 3 sub-milestones (basic derivatives, chain rule exercises, applied extrema optimization).`;
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
