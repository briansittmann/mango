import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@/lib/supabase/*", "@/lib/data/*"],
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/{atoms,molecules,organisms,templates}/**/*.{ts,tsx}"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        { noStrings: true, ignoreProps: true, allowedStrings: ["·", "+", "/"] },
      ],
    },
  },
  {
    files: ["components/atoms/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@/lib/supabase/*", "@/lib/data/*"],
              allowTypeImports: true,
            },
            {
              group: ["**/molecules/*", "**/organisms/*", "**/templates/*"],
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/molecules/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@/lib/supabase/*", "@/lib/data/*"],
              allowTypeImports: true,
            },
            {
              group: ["**/organisms/*", "**/templates/*"],
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/organisms/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@/lib/supabase/*", "@/lib/data/*"],
              allowTypeImports: true,
            },
            {
              group: ["**/templates/*"],
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "referencia/**",
  ]),
]);

export default eslintConfig;
