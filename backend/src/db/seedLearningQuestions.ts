import { query } from './connection.js';

type SeedQuestion = {
  classLevel: 'jhs1' | 'jhs2' | 'jhs3';
  subject: 'maths' | 'science' | 'english';
  term: 1 | 2 | 3;
  questionText: string;
  options: { a: string; b: string; c: string; d: string };
  correct: 'a' | 'b' | 'c' | 'd';
};

const BANK: Record<'maths' | 'science' | 'english', Array<Omit<SeedQuestion, 'classLevel' | 'term' | 'subject'>>> = {
  maths: [
    { questionText: 'If 2x = 10, what is x?', options: { a: '3', b: '4', c: '5', d: '6' }, correct: 'c' },
    { questionText: 'What is 15% of 200?', options: { a: '20', b: '25', c: '30', d: '35' }, correct: 'c' },
    { questionText: 'Simplify: 3(2 + 4)', options: { a: '12', b: '18', c: '20', d: '24' }, correct: 'b' },
    { questionText: 'What is the value of 9 squared?', options: { a: '18', b: '72', c: '81', d: '90' }, correct: 'c' },
    { questionText: 'Which is a prime number?', options: { a: '21', b: '27', c: '29', d: '35' }, correct: 'c' },
    { questionText: 'What is 3/4 as a decimal?', options: { a: '0.25', b: '0.5', c: '0.75', d: '1.25' }, correct: 'c' },
    { questionText: 'Find the mean of 4, 6, 8, 10.', options: { a: '6', b: '7', c: '8', d: '9' }, correct: 'b' },
    { questionText: 'How many degrees are in a right angle?', options: { a: '45', b: '90', c: '120', d: '180' }, correct: 'b' },
    { questionText: 'What is 7 × 8?', options: { a: '54', b: '56', c: '58', d: '64' }, correct: 'b' },
    { questionText: 'Solve: 45 ÷ 5', options: { a: '7', b: '8', c: '9', d: '10' }, correct: 'c' },
  ],
  science: [
    { questionText: 'Which organ pumps blood around the body?', options: { a: 'Lungs', b: 'Heart', c: 'Liver', d: 'Kidney' }, correct: 'b' },
    { questionText: 'Plants make food through _____.', options: { a: 'Respiration', b: 'Photosynthesis', c: 'Fermentation', d: 'Digestion' }, correct: 'b' },
    { questionText: 'Water boils at what temperature (at sea level)?', options: { a: '90°C', b: '95°C', c: '100°C', d: '110°C' }, correct: 'c' },
    { questionText: 'Which gas do humans breathe in most for life?', options: { a: 'Carbon dioxide', b: 'Nitrogen', c: 'Oxygen', d: 'Hydrogen' }, correct: 'c' },
    { questionText: 'The force that pulls objects toward Earth is called _____.', options: { a: 'Magnetism', b: 'Friction', c: 'Gravity', d: 'Pressure' }, correct: 'c' },
    { questionText: 'Which part of the plant absorbs water?', options: { a: 'Leaf', b: 'Stem', c: 'Flower', d: 'Root' }, correct: 'd' },
    { questionText: 'Which state of matter has a fixed shape?', options: { a: 'Solid', b: 'Liquid', c: 'Gas', d: 'Plasma' }, correct: 'a' },
    { questionText: 'Which body system helps us breathe?', options: { a: 'Digestive', b: 'Respiratory', c: 'Nervous', d: 'Circulatory' }, correct: 'b' },
    { questionText: 'An eclipse happens when one object blocks _____.', options: { a: 'Sound', b: 'Light', c: 'Heat', d: 'Air' }, correct: 'b' },
    { questionText: 'Which of these is a renewable source of energy?', options: { a: 'Coal', b: 'Petrol', c: 'Solar', d: 'Diesel' }, correct: 'c' },
  ],
  english: [
    { questionText: 'Choose the correct synonym of "happy".', options: { a: 'Sad', b: 'Joyful', c: 'Angry', d: 'Tired' }, correct: 'b' },
    { questionText: 'Which sentence is in the past tense?', options: { a: 'She goes to school.', b: 'She is going to school.', c: 'She went to school.', d: 'She will go to school.' }, correct: 'c' },
    { questionText: 'Pick the correct punctuation: "What is your name__"', options: { a: '.', b: ',', c: '!', d: '?' }, correct: 'd' },
    { questionText: 'Identify the noun: "The boy kicked the ball."', options: { a: 'kicked', b: 'the', c: 'boy', d: 'kicked the' }, correct: 'c' },
    { questionText: 'Which word is an adjective?', options: { a: 'Quickly', b: 'Beautiful', c: 'Run', d: 'Teacher' }, correct: 'b' },
    { questionText: 'Choose the correct opposite of "increase".', options: { a: 'Grow', b: 'Expand', c: 'Reduce', d: 'Add' }, correct: 'c' },
    { questionText: 'Fill in the blank: "Ama and Kofi ___ friends."', options: { a: 'is', b: 'are', c: 'was', d: 'be' }, correct: 'b' },
    { questionText: 'Which is a complete sentence?', options: { a: 'Because I was late.', b: 'Running to school.', c: 'The bell rang loudly.', d: 'When the rain stopped.' }, correct: 'c' },
    { questionText: 'Choose the correctly spelt word.', options: { a: 'Recieve', b: 'Receive', c: 'Receeve', d: 'Receve' }, correct: 'b' },
    { questionText: 'What is the plural of "child"?', options: { a: 'Childs', b: 'Childes', c: 'Children', d: 'Childrens' }, correct: 'c' },
  ],
};

async function seed() {
  const levels: Array<'jhs1' | 'jhs2' | 'jhs3'> = ['jhs1', 'jhs2', 'jhs3'];
  const terms: Array<1 | 2 | 3> = [1, 2, 3];
  for (const classLevel of levels) {
    for (const term of terms) {
      for (const subject of ['maths', 'science', 'english'] as const) {
        const template = BANK[subject];
        for (const q of template) {
          await query(
            `INSERT INTO learning_questions
             (class_level, subject, term, question_text, option_a, option_b, option_c, option_d, correct_option, question_source, school_id, teacher_id, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'system',NULL,NULL,true)
             ON CONFLICT DO NOTHING`,
            [classLevel, subject, term, q.questionText, q.options.a, q.options.b, q.options.c, q.options.d, q.correct]
          ).catch(() => {});
        }
      }
    }
  }
  console.log('Learning questions seeded (JHS1-3, Maths/Science/English, 10 per term/subject).');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed learning questions failed:', e);
    process.exit(1);
  });
