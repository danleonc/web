type Props = { scene?: string; hero?: boolean };
export function Illustration({ scene = "coffee", hero = false }: Props) {
  if (hero)
    return (
      <svg
        className="hero-art"
        viewBox="0 0 430 300"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M18 238C4 167 44 103 121 91c72-11 67-66 150-50s97 112 113 155c16 44-43 68-111 66S33 310 18 238Z"
          fill="#E7D6B4"
        />
        <path
          d="M327 256c-6-63-14-115-1-165m-1 89c-40-5-56-34-42-53 26 5 40 27 42 53Zm-1-38c34-9 48-36 35-52-24 7-34 26-35 52Zm-1 76c33-7 54-28 46-49-29 5-44 25-46 49Z"
          fill="#647A55"
          stroke="#647A55"
          strokeWidth="3"
        />
        <ellipse cx="206" cy="242" rx="116" ry="20" fill="#D1B890" />
        <path
          d="m120 178-13 68m-5-66 31 68m164-68 13 68m5-68-31 68"
          stroke="#3C5E50"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M84 120q-13 45 12 63h39M326 119q11 45-13 64h-37"
          stroke="#3C5E50"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M107 163c-2-26-1-62 22-65 23-2 36 34 51 52l-18 17-23-20 7 48-27 42-15-7 19-42Z"
          fill="#CF7457"
        />
        <path
          d="m139 119 31 26 31-6"
          stroke="#BC795B"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle cx="133" cy="78" r="22" fill="#BF815E" />
        <path
          d="M111 76c-12-32 38-39 45-12l-11-1-4 13-15-13-15 13Z"
          fill="#3C473C"
        />
        <path
          d="M291 162c2-26-1-63-24-65-23-2-35 35-51 53l18 18 23-22-6 49 28 42 15-7-19-42Z"
          fill="#69867B"
        />
        <path
          d="m257 120-28 25-31-5"
          stroke="#D39B76"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle cx="266" cy="78" r="22" fill="#D39B76" />
        <path
          d="M242 77c-4-22 8-32 25-29 22 1 30 32 18 43l-7-25c-13 8-22-4-27 8Z"
          fill="#4E3F35"
        />
        <path
          d="m153 238 18 5m107-6-18 6"
          stroke="#3D4D40"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <ellipse cx="199" cy="163" rx="64" ry="10" fill="#B58C59" />
        <path d="m189 172-9 72m28-72 10 72" stroke="#A77D4D" strokeWidth="5" />
        <path d="M172 139h17v14h-17zm40 0h17v14h-17z" fill="#F8F0DF" />
        <path
          d="M189 142c9-3 9 9 0 7m40-7c9-3 9 9 0 7"
          stroke="#F8F0DF"
          strokeWidth="3"
        />
        <path
          d="m191 73 3-10m12 12 8-7m-36 9-6-7"
          stroke="#B58A52"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="61" cy="121" r="5" fill="#B58A52" />
        <path d="M56 205h28l-5 32H61z" fill="#C09F79" />
        <path
          d="M70 205v-42m0 25c-18-2-24-12-21-21 15 0 21 11 21 21Zm0-15c18-2 24-13 20-22-14 2-20 13-20 22Z"
          fill="#74875C"
        />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 360 190"
      fill="none"
      className="activity-art"
      aria-hidden="true"
    >
      <circle cx="288" cy="41" r="24" fill="currentColor" opacity=".08" />
      <path
        d="M30 157c62-51 139-48 199-24s82 10 110-14"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".14"
      />
      {scene === "coffee" && (
        <>
          <ellipse
            cx="179"
            cy="153"
            rx="99"
            ry="12"
            fill="#A3664F"
            opacity=".14"
          />
          <path d="M106 84h67v43c0 35-67 35-67 0Z" fill="#FAF1DF" />
          <path
            d="M173 94c33-11 37 36 0 30"
            stroke="#FAF1DF"
            strokeWidth="10"
          />
          <ellipse cx="140" cy="84" rx="33" ry="7" fill="#875B43" />
          <path d="M206 102h48v31c0 26-48 26-48 0Z" fill="#6D8C79" />
          <path d="M254 109c25-8 27 25 0 22" stroke="#6D8C79" strokeWidth="7" />
          <path
            d="M135 64c-13-16 14-17 3-34m89 51c-10-13 12-15 3-27"
            stroke="#AC7C62"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="m78 119-12-19m13 39-22 2m237-61 11-12m-8 29 20 3"
            stroke="#B77A54"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      {scene === "art" && (
        <>
          <path
            d="m130 151 29-112h67l27 112m-98-53h70m-80 27h91"
            stroke="#A38872"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path d="M128 35h119v88H128z" fill="#FBF5E9" />
          <circle cx="191" cy="69" r="19" fill="#D58F70" />
          <path d="m140 112 30-40 35 40m-15 0 26-27 21 27" fill="#809A86" />
          <path d="m94 149 19-59 7 3-19 59z" fill="#758E85" />
          <path d="m113 90 9-15-2 18" fill="#AF745A" />
          <ellipse cx="276" cy="144" rx="25" ry="10" fill="#D7B88C" />
          <circle cx="268" cy="143" r="4" fill="#CF886B" />
          <circle cx="281" cy="140" r="4" fill="#6C8978" />
        </>
      )}
      {scene === "walk" && (
        <>
          <circle cx="245" cy="49" r="24" fill="#E8CE8E" />
          <path
            d="M48 145c42-69 85-62 130 0m-13 0c51-80 99-73 148 0"
            fill="#B5C5A1"
          />
          <path d="M89 145c47-30 89-27 124 0" fill="#899F81" />
          <path
            d="M192 151c-11-34-9-70-2-101m-1 58c-24-2-37-19-29-33 21 3 28 17 29 33Zm0-29c26-5 35-22 27-35-20 3-27 18-27 35Z"
            fill="#517663"
          />
          <path
            d="M124 102v33m0-24-14 11m14-10 13 9m-13 14-10 18m10-18 9 18"
            stroke="#B67B5E"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="124" cy="88" r="9" fill="#B67B5E" />
        </>
      )}
      {scene === "book" && (
        <>
          <path
            d="M180 68c-29-23-65-20-98-12v82c33-8 69-10 98 13 29-23 65-21 98-13V56c-33-8-69-11-98 12Z"
            fill="#F9F2E1"
          />
          <path d="M180 68v83" stroke="#C4B497" strokeWidth="3" />
          <path
            d="m99 77 55 5m-55 12 55 5m-55 12 39 3m63-32 55-5m-55 22 55-5m-55 22 38-4"
            stroke="#B4B39A"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M218 51v42l12-9 12 6V49" fill="#B87960" />
        </>
      )}
      {scene === "music" && (
        <>
          <circle cx="184" cy="100" r="60" fill="#5E7B78" />
          <circle cx="184" cy="100" r="44" stroke="#97AE9C" />
          <circle cx="184" cy="100" r="28" fill="#E2BD8F" />
          <circle cx="184" cy="100" r="7" fill="#FAF1E1" />
          <path d="M91 89V52l29-6v37" stroke="#8C735E" strokeWidth="4" />
          <ellipse cx="84" cy="90" rx="9" ry="7" fill="#8C735E" />
          <ellipse cx="113" cy="84" rx="9" ry="7" fill="#8C735E" />
          <path d="m274 92 10 38m-7-28 18-5" stroke="#B9856B" strokeWidth="4" />
          <ellipse cx="277" cy="133" rx="9" ry="7" fill="#B9856B" />
        </>
      )}
      {scene === "table" && (
        <>
          <ellipse cx="180" cy="118" rx="104" ry="38" fill="#BB8C70" />
          <ellipse cx="180" cy="111" rx="104" ry="38" fill="#E4C7A5" />
          <ellipse cx="180" cy="112" rx="43" ry="24" fill="#F9F1DF" />
          <path d="M158 111c4-25 36-25 43 0Z" fill="#C18C5C" />
          <path d="m171 96 3 10m8-12 4 11" stroke="#F6E4B7" strokeWidth="3" />
          <path d="M108 78h24v19h-24zm126 0h24v19h-24z" fill="#7B9582" />
          <path d="M104 128v32m152-32v32" stroke="#A8795F" strokeWidth="6" />
        </>
      )}
    </svg>
  );
}
