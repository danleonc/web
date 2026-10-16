export type Category = "Conversaciones" | "Creatividad" | "Bienestar";
export type Activity = {
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  startsAt: string;
  duration: number;
  capacity: number;
  occupied: number;
  color: "peach" | "sage" | "lavender" | "sand" | "blue" | "rose";
  scene: "coffee" | "art" | "walk" | "book" | "music" | "table";
  tags: string[];
  description: string;
  prompt: string;
  people: string[];
};
export const activities: Activity[] = [
  {
    id: "cafe",
    title: "Un café, mil historias",
    subtitle: "Las buenas conversaciones empiezan con algo simple.",
    category: "Conversaciones",
    startsAt: "2026-10-16T22:00:00Z",
    duration: 45,
    capacity: 6,
    occupied: 3,
    color: "peach",
    scene: "coffee",
    tags: ["Conversar", "Vida cotidiana"],
    description:
      "Un encuentro virtual tranquilo para compartir esas pequeñas historias que nos hacen quienes somos. Trae tu bebida favorita y la curiosidad de conocer a alguien nuevo. No hay respuestas correctas ni obligación de hablar.",
    prompt: "¿Qué pequeña cosa te ha alegrado la semana?",
    people: ["Antonia", "Nicolás", "Camila"],
  },
  {
    id: "crear",
    title: "Crear por el gusto de crear",
    subtitle: "Un papel, un lápiz y un poco de imaginación.",
    category: "Creatividad",
    startsAt: "2026-10-17T15:00:00Z",
    duration: 60,
    capacity: 6,
    occupied: 4,
    color: "lavender",
    scene: "art",
    tags: ["Creatividad", "Descubrir"],
    description:
      "Dibujaremos ideas sencillas y compartiremos lo que aparece por el camino. No necesitas saber dibujar: el propósito es disfrutar y conversar. Ten a mano papel y cualquier lápiz.",
    prompt: "Si tu semana fuera un paisaje, ¿cómo lo dibujarías?",
    people: ["Valentina", "Tomás", "Daniela", "Felipe"],
  },
  {
    id: "pausa",
    title: "Una pausa para encontrarnos",
    subtitle: "Bajar el ritmo también puede ser un plan compartido.",
    category: "Bienestar",
    startsAt: "2026-10-18T14:00:00Z",
    duration: 40,
    capacity: 5,
    occupied: 2,
    color: "sage",
    scene: "walk",
    tags: ["Bienestar", "Vida cotidiana"],
    description:
      "Una conversación virtual sobre los pequeños rituales que nos ayudan a hacer una pausa. Puedes escuchar, participar o simplemente estar. Esta actividad social no es terapia ni atención de salud.",
    prompt: "¿Qué lugar te ayuda a sentir calma?",
    people: ["Javiera", "Andrés"],
  },
  {
    id: "libros",
    title: "Historias que se quedan",
    subtitle: "Ese libro que siempre terminas recomendando.",
    category: "Conversaciones",
    startsAt: "2026-10-20T22:30:00Z",
    duration: 50,
    capacity: 6,
    occupied: 2,
    color: "sand",
    scene: "book",
    tags: ["Lectura", "Conversar"],
    description:
      "Comparte un libro, un cuento o una historia que te acompañe. No hay lectura previa ni examen: solo ganas de descubrir nuevas perspectivas.",
    prompt: "¿Qué personaje invitarías a tomar un café y por qué?",
    people: ["Francisca", "Diego"],
  },
  {
    id: "musica",
    title: "La banda sonora de tu vida",
    subtitle: "Canciones, recuerdos y algunas coincidencias.",
    category: "Creatividad",
    startsAt: "2026-10-21T22:00:00Z",
    duration: 45,
    capacity: 6,
    occupied: 3,
    color: "blue",
    scene: "music",
    tags: ["Música", "Descubrir"],
    description:
      "Hablemos de las canciones que marcan momentos. Basta con recordar una canción: no necesitas suscripción musical, micrófono ni compartir archivos.",
    prompt: "¿Qué canción te transporta a un momento feliz?",
    people: ["Sofía", "Matías", "Paula"],
  },
  {
    id: "mesa",
    title: "Recetas con historia",
    subtitle: "Lo que cocinamos también cuenta de dónde venimos.",
    category: "Conversaciones",
    startsAt: "2026-10-23T22:00:00Z",
    duration: 45,
    capacity: 6,
    occupied: 4,
    color: "rose",
    scene: "table",
    tags: ["Cocina", "Conversar"],
    description:
      "Una mesa virtual para compartir recuerdos y recetas. No hace falta cocinar ni encender la cámara. Trae la historia de un sabor que te guste.",
    prompt: "¿Qué plato te recuerda a alguien especial?",
    people: ["María", "Cristóbal", "Isidora", "Pedro"],
  },
];
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
