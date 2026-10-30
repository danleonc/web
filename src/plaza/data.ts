import type { ImageRef } from "../media/types";
export const plazaTopics = [
  {
    id: "cultura",
    label: "Historias y mundos posibles",
    short: "Cultura",
    activityId: "cafe",
    color: "apricot",
    interests: ["Lectura", "Música", "Conversar", "Descubrir"],
  },
  {
    id: "crear",
    label: "Ideas fuera del guion",
    short: "Creatividad",
    activityId: "crear",
    color: "lilac",
    interests: ["Creatividad", "Descubrir", "Conversar"],
  },
  {
    id: "cotidiano",
    label: "La vida sin manual",
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
  replyTo?: string;
  postId: string;
  body: string;
  author: string;
  own: boolean;
  stickerId?: string;
  image?: ImageRef;
  personId?: string;
};
export type PlazaInvitation = {
  personId: string;
  postId: string;
  note: string;
  commentId?: string;
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
    title: "¿Qué canción sería el tráiler de tu vida?",
    body: "Se abre la escena, apareces tú y empieza a sonar una canción. ¿Cuál eliges y qué tendría que estar pasando? Vale una respuesta épica, nostálgica o completamente inesperada.",
    own: false,
    art: "music",
    tags: ["Música", "Conversar"],
  },
  {
    id: "crear-sin-prisa",
    personId: "valentina",
    author: "Valentina",
    topic: "crear",
    title: "Tienes un local vacío. ¿Qué inventamos ahí?",
    body: "Imagina que por un día tenemos un local y podemos probar una idea improbable. Yo mezclaría librería, juegos y una mesa enorme para conversar. ¿Qué le sumarías o cambiarías?",
    own: false,
    art: "art",
    tags: ["Creatividad", "Descubrir"],
  },
  {
    id: "pequenos-rituales",
    personId: "javiera",
    author: "Javiera",
    topic: "cotidiano",
    title: "¿Qué cosa de ser adulto nadie te advirtió?",
    body: "Pensé que tendría todo más resuelto. Ahora celebro acordarme de sacar la ropa de la lavadora. ¿Qué descubrimiento cotidiano te habría gustado conocer antes?",
    own: false,
    art: "garden",
    tags: ["Bienestar", "Vida cotidiana"],
  },
  {
    id: "libro-prestado",
    personId: "antonia",
    author: "Antonia",
    topic: "cultura",
    title: "¿En qué mundo de ficción vivirías una semana?",
    body: "Una semana en tu serie, libro o videojuego favorito, con derecho a volver. ¿Qué harías primero y qué detalle te haría arrepentirte de la elección?",
    own: false,
    art: "books",
    tags: ["Lectura", "Conversar"],
  },
  {
    id: "historia-juntos",
    personId: "valentina",
    author: "Valentina",
    topic: "crear",
    title: "Si la IA hiciera lo aburrido, ¿qué harías tú?",
    body: "Imaginemos un futuro en el que puedes delegar todas tus tareas repetitivas. ¿A qué le regalarías ese tiempo? Yo aprendería algo por puro gusto, sin pensar en ponerlo en un currículum.",
    own: false,
    tags: ["Creatividad", "Descubrir"],
  },
  {
    id: "receta-recuerdo",
    personId: "javiera",
    author: "Javiera",
    topic: "cotidiano",
    title: "¿Qué plan de bajo presupuesto te hace feliz?",
    body: "Una once improvisada, cocinar con lo que hay o ver una película mala en buena compañía. ¿Qué plan simple siempre termina siendo mejor de lo esperado?",
    own: false,
    tags: ["Cocina", "Conversar"],
  },
];
export const seedComments: PlazaComment[] = [
  {
    id: "ejemplo-cancion",
    personId: "javiera",
    postId: "cancion",
    author: "Javiera",
    body: "Una de los viajes en familia: mi primer capítulo empezaría mirando por la ventana, antes de que llegue el estribillo.",
    own: false,
  },
  {
    id: "ejemplo-crear",
    personId: "antonia",
    postId: "crear-sin-prisa",
    author: "Antonia",
    body: "Una librería donde cada libro viene con una nota de quien lo leyó antes. Y una mesa para quedarse conversando.",
    own: false,
  },
];
export const plazaPeople = [
  {
    id: "antonia",
    name: "Antonia",
    description: "Canciones, mundos de ficción y vidas que podríamos imaginar.",
    interests: ["Lectura", "Música", "Conversar"],
    postId: "cancion",
    topic: "cultura" as TopicId,
  },
  {
    id: "valentina",
    name: "Valentina",
    description: "Ideas improbables y ganas de inventar algo entre todos.",
    interests: ["Creatividad", "Descubrir", "Lectura"],
    postId: "crear-sin-prisa",
    topic: "crear" as TopicId,
  },
  {
    id: "javiera",
    name: "Javiera",
    description: "Humor de la vida adulta y planes simples que alegran el día.",
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
