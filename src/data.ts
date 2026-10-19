export type Category = "Conversaciones" | "Creatividad" | "Bienestar";
export type Activity = {
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  startsAt: string;
  duration: number;
  capacity: number;
  minimum: number;
  occupied: number;
  archived: boolean;
  color: "peach" | "sage" | "lavender" | "sand" | "blue" | "rose";
  scene: "coffee" | "art" | "walk" | "book" | "music" | "table";
  tags: string[];
  description: string;
  prompt: string;
  questions: string[];
  people: string[];
};
// One shared upcoming example slot. These are illustrative dates, never live availability.
function nextExampleSlot() {
  const now = new Date();
  const days = (4 - now.getUTCDay() + 7) % 7 || 7;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + days,
      22,
    ),
  ).toISOString();
}
const exampleSlot = nextExampleSlot();
export const activities: Activity[] = [
  {
    id: "cafe",
    title: "Historias y cultura",
    subtitle:
      "Un café y una historia para compartir. El resto lo descubre el grupo.",
    category: "Conversaciones",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "peach",
    scene: "book",
    tags: ["Conversar", "Lectura", "Música", "Descubrir"],
    description:
      "Un grupo pequeño para compartir historias, canciones, libros o recuerdos. Empezamos con una pregunta concreta y dejamos que la conversación encuentre sus propios caminos. Puedes escuchar, pasar o responder con un sticker.",
    prompt: "¿Qué historia, canción o recuerdo te ha acompañado últimamente?",
    people: ["Antonia", "Nicolás", "Camila", "Javiera", "Diego"],
    questions: [
      "¿Qué historia, canción o recuerdo te ha acompañado últimamente?",
      "¿Qué descubriste al escuchar a alguien de este grupo?",
      "¿Qué te gustaría volver a compartir en otro encuentro?",
    ],
    minimum: 3,
    archived: false,
  },
  {
    id: "crear",
    title: "Crear y descubrir",
    subtitle:
      "Una historia entre todos, sin necesidad de saber dibujar o escribir.",
    category: "Creatividad",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "lavender",
    scene: "art",
    tags: ["Creatividad", "Descubrir", "Conversar"],
    description:
      "Construimos una historia breve entre todos: cada persona puede aportar una frase, un sticker o simplemente escuchar. La dinámica sirve para romper el hielo y luego conversar libremente.",
    prompt: "Imaginemos un lugar inesperado: ¿dónde empieza nuestra historia?",
    people: ["Valentina", "Tomás", "Daniela", "Felipe", "Javiera"],
    questions: [
      "Imaginemos un lugar inesperado: ¿dónde empieza nuestra historia?",
      "¿Qué personaje o giro te gustaría sumar? Puedes responder con un sticker.",
      "¿Qué parte de crear juntos te gustaría repetir?",
    ],
    minimum: 3,
    archived: false,
  },
  {
    id: "pausa",
    title: "Vida cotidiana y pequeños planes",
    subtitle:
      "Lo que nos alegra, lo que aprendemos y lo que nos gustaría compartir.",
    category: "Bienestar",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "sage",
    scene: "walk",
    tags: ["Bienestar", "Vida cotidiana", "Cocina", "Conversar"],
    description:
      "Una conversación ligera sobre lo cotidiano y los pequeños planes. No hace falta contar intimidades: puedes compartir un gusto, una anécdota o una idea. Es un encuentro social, no terapia ni atención de salud.",
    prompt: "¿Qué pequeña cosa te ha alegrado o dado curiosidad esta semana?",
    people: ["Javiera", "Andrés", "Diego", "Francisca", "Tomás"],
    questions: [
      "¿Qué pequeña cosa te ha alegrado o dado curiosidad esta semana?",
      "¿Qué actividad sencilla te gustaría compartir con otras personas?",
      "¿Qué te llevas de esta conversación, si quieres contarlo?",
    ],
    minimum: 3,
    archived: false,
  },
  {
    id: "libros",
    title: "Historias que se quedan",
    subtitle: "Ese libro que siempre terminas recomendando.",
    category: "Conversaciones",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "sand",
    scene: "book",
    tags: ["Lectura", "Conversar"],
    description:
      "Comparte un libro, un cuento o una historia que te acompañe. No hay lectura previa ni examen: solo ganas de descubrir nuevas perspectivas.",
    prompt: "¿Qué personaje invitarías a tomar un café y por qué?",
    people: ["Francisca", "Diego", "Javiera", "Tomás", "Paula"],
    minimum: 3,
    archived: true,
    questions: [
      "¿Qué personaje invitarías a tomar un café y por qué?",
      "¿Qué te dio curiosidad de lo que compartimos?",
      "¿Qué te gustaría conversar la próxima vez?",
    ],
  },
  {
    id: "musica",
    title: "La banda sonora de tu vida",
    subtitle: "Canciones, recuerdos y algunas coincidencias.",
    category: "Creatividad",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "blue",
    scene: "music",
    tags: ["Música", "Descubrir"],
    description:
      "Hablemos de las canciones que marcan momentos. Basta con recordar una canción: no necesitas suscripción musical, micrófono ni compartir archivos.",
    prompt: "¿Qué canción te transporta a un momento feliz?",
    people: ["Sofía", "Matías", "Paula", "Javiera", "Diego"],
    minimum: 3,
    archived: true,
    questions: [
      "¿Qué canción te transporta a un momento feliz?",
      "¿Qué te dio curiosidad de lo que compartimos?",
      "¿Qué te gustaría conversar la próxima vez?",
    ],
  },
  {
    id: "mesa",
    title: "Recetas con historia",
    subtitle: "Lo que cocinamos también cuenta de dónde venimos.",
    category: "Conversaciones",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "rose",
    scene: "table",
    tags: ["Cocina", "Conversar"],
    description:
      "Una mesa virtual para compartir recuerdos y recetas. No hace falta cocinar ni encender la cámara. Trae la historia de un sabor que te guste.",
    prompt: "¿Qué plato te recuerda a alguien especial?",
    people: ["María", "Cristóbal", "Isidora", "Pedro", "Javiera"],
    minimum: 3,
    archived: true,
    questions: [
      "¿Qué plato te recuerda a alguien especial?",
      "¿Qué te dio curiosidad de lo que compartimos?",
      "¿Qué te gustaría conversar la próxima vez?",
    ],
  },
];
export const featuredActivities = activities.filter((a) => !a.archived);
export const interests = [
  "Conversar",
  "Lectura",
  "Música",
  "Creatividad",
  "Bienestar",
  "Cocina",
  "Descubrir",
  "Vida cotidiana",
];
export const boundaryOptions = [
  "Sin insinuaciones románticas",
  "Prefiero evitar temas íntimos",
  "Sin contacto fuera de la plataforma",
];
export function dateLabel(iso: string, compact = false) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    weekday: compact ? undefined : "long",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}
export function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
