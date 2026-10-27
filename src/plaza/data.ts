import type { ImageRef } from "../media/types";
export const plazaTopics = [
  {
    id: "cultura",
    label: "Historias y cultura",
    short: "Cultura",
    activityId: "cafe",
    color: "apricot",
    interests: ["Lectura", "Música", "Conversar", "Descubrir"],
  },
  {
    id: "crear",
    label: "Crear y descubrir",
    short: "Creatividad",
    activityId: "crear",
    color: "lilac",
    interests: ["Creatividad", "Descubrir", "Conversar"],
  },
  {
    id: "cotidiano",
    label: "Pequeñas cosas",
    short: "Vida cotidiana",
    activityId: "pausa",
    color: "sage",
    interests: ["Bienestar", "Vida cotidiana", "Cocina", "Conversar"],
  },
] as const;
export type TopicId = (typeof plazaTopics)[number]["id"];
export type PlazaPost = {
  id: string;
  topic: TopicId;
  title: string;
  body: string;
  author: string;
  personId: string;
  own: boolean;
  art?: "music" | "books" | "garden" | "art";
  tags: string[];
  image?: ImageRef;
};
export type PlazaComment = {
  id: string;
  postId: string;
  body: string;
  author: string;
  own: boolean;
  stickerId?: string;
  image?: ImageRef;
};
export type PlazaInvitation = {
  personId: string;
  postId: string;
  note: string;
};
export type PlazaState = {
  posts: PlazaPost[];
  comments: PlazaComment[];
  saved: string[];
  hidden: string[];
  invitations: PlazaInvitation[];
};
export const emptyPlaza: PlazaState = {
  posts: [],
  comments: [],
  saved: [],
  hidden: [],
  invitations: [],
};
export const seedPosts: PlazaPost[] = [
  {
    id: "cancion",
    personId: "antonia",
    author: "Antonia",
    topic: "cultura",
    title: "¿Qué canción te lleva de vuelta a un lugar?",
    body: "A mí me pasa con las canciones que sonaban en la cocina de mi abuela. A veces una melodía guarda una historia entera. ¿Cuál es la tuya?",
    own: false,
    art: "music",
    tags: ["Música", "Conversar"],
  },
  {
    id: "crear-sin-prisa",
    personId: "valentina",
    author: "Valentina",
    topic: "crear",
    title: "Crear algo, aunque no salga perfecto.",
    body: "Volví a dibujar después de mucho tiempo. Esta vez estoy intentando disfrutarlo sin que tenga que quedar «bonito». ¿Qué te gustaría volver a hacer por puro gusto?",
    own: false,
    art: "art",
    tags: ["Creatividad", "Descubrir"],
  },
  {
    id: "pequenos-rituales",
    personId: "javiera",
    author: "Javiera",
    topic: "cotidiano",
    title: "Esas pequeñas cosas que hacen bien.",
    body: "Caminar sin mirar el teléfono y descubrir una calle distinta. Ese fue mi pequeño cambio de esta semana. ¿Tienes algún ritual que te alegre el día?",
    own: false,
    art: "garden",
    tags: ["Bienestar", "Vida cotidiana"],
  },
  {
    id: "libro-prestado",
    personId: "antonia",
    author: "Antonia",
    topic: "cultura",
    title: "Un libro que terminarías prestando.",
    body: "Me gustan los libros que dejan ganas de conversar, aunque cada persona los entienda distinto. Busco recomendaciones con una pequeña historia detrás, más que una reseña.",
    own: false,
    art: "books",
    tags: ["Lectura", "Conversar"],
  },
  {
    id: "historia-juntos",
    personId: "valentina",
    author: "Valentina",
    topic: "crear",
    title: "Si hoy empezara una historia, ¿dónde sería?",
    body: "Yo propongo una biblioteca donde los libros cambian de lugar cada noche. Puedes sumar una idea o simplemente leer lo que imaginamos.",
    own: false,
    tags: ["Creatividad", "Lectura"],
  },
  {
    id: "receta-recuerdo",
    personId: "javiera",
    author: "Javiera",
    topic: "cotidiano",
    title: "Una receta que sabe a recuerdo.",
    body: "No hace falta saber cocinar para tener una historia alrededor de la mesa. ¿Qué plato asocias a una persona o a un momento especial?",
    own: false,
    tags: ["Cocina", "Conversar"],
  },
];
export const seedComments: PlazaComment[] = [
  {
    id: "ejemplo-cancion",
    postId: "cancion",
    author: "Javiera",
    body: "Las canciones de los viajes en familia. Siempre termino recordando el paisaje antes que la letra.",
    own: false,
  },
  {
    id: "ejemplo-crear",
    postId: "crear-sin-prisa",
    author: "Antonia",
    body: "Me pasa con escribir. A veces una página sin corregir nada ya es un buen comienzo.",
    own: false,
  },
];
export const plazaPeople = [
  {
    id: "antonia",
    name: "Antonia",
    description: "Historias, libros y canciones con algo que contar.",
    interests: ["Lectura", "Música", "Conversar"],
    postId: "cancion",
    topic: "cultura" as TopicId,
  },
  {
    id: "valentina",
    name: "Valentina",
    description: "Curiosidad por crear y probar algo por primera vez.",
    interests: ["Creatividad", "Descubrir", "Lectura"],
    postId: "crear-sin-prisa",
    topic: "crear" as TopicId,
  },
  {
    id: "javiera",
    name: "Javiera",
    description: "Pequeños planes, recetas y un poco de aire libre.",
    interests: ["Bienestar", "Vida cotidiana", "Cocina"],
    postId: "pequenos-rituales",
    topic: "cotidiano" as TopicId,
  },
];
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
export const isPlazaPersonBlocked = (name: string, blocked: string[]) =>
  blocked.some((key) => key === name || key.endsWith(`:${name}`));
