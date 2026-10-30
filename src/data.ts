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
    title: "¿Y si pudieras vivir otra vida?",
    subtitle:
      "Cambiar de país, empezar de cero o entrar a una película. ¿Qué elegirías?",
    category: "Conversaciones",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "peach",
    scene: "book",
    tags: ["Conversar", "Lectura", "Música", "Descubrir"],
    description:
      "Por un rato, todo puede ser distinto: otro lugar, otro oficio o el universo de una película. Compartimos posibilidades, canciones e historias para descubrir qué nos mueve. Puedes hablar desde la imaginación, escuchar o pasar; no hace falta contar intimidades.",
    prompt: "Puedes probar otra vida durante un año. ¿Dónde estás y qué haces?",
    people: ["Antonia", "Nicolás", "Camila", "Javiera", "Diego"],
    questions: [
      "Puedes probar otra vida durante un año. ¿Dónde estás y qué haces?",
      "¿Qué canción, película o libro tendría un lugar en esa vida?",
      "¿Qué idea del grupo te dio ganas de probar algo distinto?",
    ],
    minimum: 3,
    archived: false,
  },
  {
    id: "crear",
    title: "Ideas tan locas que podrían funcionar",
    subtitle:
      "Un lugar que aún no existe, una solución absurda o una mezcla inesperada.",
    category: "Creatividad",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "lavender",
    scene: "art",
    tags: ["Creatividad", "Descubrir", "Conversar"],
    description:
      "Inventamos algo entre todos: un café imposible, un invento para la vida diaria o un plan que mezcle nuestros gustos. Cada idea puede crecer con lo que aporte otra persona. No necesitas saber dibujar, emprender ni tener una respuesta brillante.",
    prompt: "Tienes un local vacío. ¿Qué lugar que aún no existe te gustaría inventar?",
    people: ["Valentina", "Tomás", "Daniela", "Felipe", "Javiera"],
    questions: [
      "Tienes un local vacío. ¿Qué lugar que aún no existe te gustaría inventar?",
      "Mezcla tu idea con la de alguien del grupo. ¿Qué aparece?",
      "¿Qué detalle propuesto por otra persona haría mejor nuestra idea?",
    ],
    minimum: 3,
    archived: false,
  },
  {
    id: "pausa",
    title: "Ser adulto no venía con manual",
    subtitle:
      "Historias que dan risa, pequeñas victorias y planes que aún nos debemos.",
    category: "Bienestar",
    startsAt: exampleSlot,
    duration: 40,
    capacity: 6,
    occupied: 3,
    color: "sage",
    scene: "walk",
    tags: ["Bienestar", "Vida cotidiana", "Cocina", "Conversar"],
    description:
      "Las compras que no duran, los planes que se postergan y esa pequeña victoria que merecía aplausos. Hablamos con humor de la vida cotidiana y compartimos ideas para disfrutarla más. No hace falta contar nada íntimo: puedes pasar o escuchar.",
    prompt: "¿Qué cosa de ser adulto te sorprendió y ahora puedes contar con humor?",
    people: ["Javiera", "Andrés", "Diego", "Francisca", "Tomás"],
    questions: [
      "¿Qué cosa de ser adulto te sorprendió y ahora puedes contar con humor?",
      "¿Qué pequeña victoria debería celebrarse mucho más?",
      "Si este grupo escribiera un manual para la semana, ¿qué consejo pondrías?",
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
