export function Brand() {
  return (
    <a className="brand" href="#" aria-label="RiskFlow home">
      <span className="brand-mark" aria-hidden="true">
        <svg
          width="24"
          height="36"
          viewBox="0 0 28 36"
          aria-hidden="true"
          style={{ display: "block" }}
        >
          <path
            fill="currentColor"
            d="M3 30V13h3v3c1.5-2.5 3.2-3.4 6-3.3v3c-4.5-.3-6 2.1-6 5.3v9ZM15 27V13h-3v-3h3V8c0-4 2-6 6-6h3v3h-2.5c-2 0-3 1-3 3v2H24v3h-5.5v14Z"
          />
        </svg>
      </span>
      <span>RiskFlow</span>
    </a>
  );
}
