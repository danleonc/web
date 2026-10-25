export function PlazaArt({
  scene = "hero",
}: {
  scene?: "hero" | "music" | "books" | "garden" | "art";
}) {
  if (scene === "hero")
    return (
      <svg
        className="plaza-hero-art"
        viewBox="0 0 440 300"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="236" cy="156" r="120" fill="#E5D7F0" />
        <path
          d="M43 228c53-22 58-80 109-114s116-22 157-58"
          stroke="#6E7962"
          strokeWidth="2"
          strokeDasharray="5 7"
        />
        <rect
          x="33"
          y="63"
          width="147"
          height="128"
          rx="15"
          fill="#FFFBF0"
          transform="rotate(-8 33 63)"
        />
        <path
          d="M63 99h65m-65 12h80"
          stroke="#C9CEB8"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="90" cy="153" r="16" fill="#E6B99B" />
        <circle cx="112" cy="151" r="16" fill="#9CB6A0" />
        <circle cx="134" cy="148" r="16" fill="#C0ACD5" />
        <path
          d="M213 241c-8-66 6-115 52-111 42 3 55 66 63 111"
          fill="#34664E"
        />
        <circle cx="263" cy="105" r="28" fill="#C58B63" />
        <path
          d="M234 105c-3-33 26-45 44-27 12 11 12 28 11 37-12-3-19-13-20-23-11 9-24 12-35 13Z"
          fill="#37463B"
        />
        <path d="M145 243c-8-46 2-83 29-87 31-5 42 45 52 87" fill="#CA7252" />
        <circle cx="169" cy="136" r="24" fill="#E5B996" />
        <path d="M145 131c-2-29 34-36 44-13l-14-4-8 17Z" fill="#695046" />
        <path
          d="m174 183 44 34 38-31"
          stroke="#E5B996"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="m278 166-13 27-28 15"
          stroke="#C58B63"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <rect x="213" y="211" width="45" height="25" rx="12" fill="#F9D49E" />
        <path
          d="m346 47 5 18 17-8-10 16 18 5-19 3 8 18-16-11-5 18-3-19-18 8 11-16-18-5 19-3-8-17 16 10Z"
          fill="#D77F5D"
        />
        <rect
          x="284"
          y="156"
          width="128"
          height="61"
          rx="13"
          fill="#FFFCF3"
          transform="rotate(8 284 156)"
        />
        <path
          d="m305 183 6 6 13-15"
          stroke="#45654E"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="m337 182 51 7m-53 5 33 4"
          stroke="#B8C8AB"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M80 229v-24m-12 12h24m267-106V92m-9 9h18"
          stroke="#627650"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="379" cy="52" r="5" fill="#D38A63" />
      </svg>
    );
  return (
    <svg
      className={`plaza-post-art art-${scene}`}
      viewBox="0 0 400 174"
      fill="none"
      aria-hidden="true"
    >
      {scene === "music" ? (
        <>
          <circle cx="240" cy="88" r="66" fill="#294D40" />
          <circle cx="240" cy="88" r="51" stroke="#6F8B6D" />
          <circle cx="240" cy="88" r="36" stroke="#6F8B6D" />
          <circle cx="240" cy="88" r="18" fill="#F2C192" />
          <circle cx="240" cy="88" r="4" fill="#294D40" />
          <path d="m106 105 5-55 46-11-5 52" stroke="#7A513F" strokeWidth="5" />
          <ellipse cx="99" cy="109" rx="14" ry="10" fill="#7A513F" />
          <ellipse cx="144" cy="95" rx="14" ry="10" fill="#7A513F" />
          <path d="M321 50v24m-12-12h24" stroke="#AA6A4A" strokeWidth="2" />
        </>
      ) : scene === "art" ? (
        <>
          <path
            d="M114 131 155 43l74 32-41 87Z"
            fill="#FFFCF1"
            transform="rotate(-10 114 131)"
          />
          <path d="m148 100 15-30 35 12-19 31Z" fill="#B7C69A" />
          <path d="m159 115 29-15 14 24-30 18Z" fill="#D88168" />
          <path
            d="m233 137 31-95"
            stroke="#6F5473"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d="m266 40 5-13 8 5-8 14" fill="#CF8E5E" />
          <circle cx="284" cy="108" r="21" fill="#8FAD90" />
          <circle cx="307" cy="120" r="14" fill="#EAC58E" />
        </>
      ) : scene === "garden" ? (
        <>
          <path
            d="M197 125c0-55 1-75-15-103m15 68c-37 0-48-27-37-36 25 0 39 16 37 36Zm0 20c38-5 52-25 41-38-26 2-43 18-41 38Zm-3-53c30-5 37-24 26-32-18 3-26 15-26 32Z"
            fill="#52744E"
          />
          <path d="M163 123h71l-11 42h-50Z" fill="#D38B65" />
          <path
            d="M282 145c4-20 21-35 40-41m-30 30c-2-24 14-31 21-23l-8 15"
            stroke="#6F8A61"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M91 74c13-12 28-12 42-2"
            stroke="#9AA981"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="289" cy="44" r="17" fill="#F0D296" />
        </>
      ) : (
        <>
          <path d="m109 127 14-90 54 9-14 90Z" fill="#CE8162" />
          <path d="m169 134-2-104 54-1 2 104Z" fill="#789273" />
          <path d="m231 131 30-85 48 16-30 85Z" fill="#B9A5CB" />
          <path
            d="m131 56 28 5m-29 4 22 4m60 42h28m47-44 22 8"
            stroke="#FFF6E6"
            strokeWidth="3"
          />
          <path
            d="M94 145h224"
            stroke="#6B8067"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
