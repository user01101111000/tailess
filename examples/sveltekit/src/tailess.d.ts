// The breakpoint src/app.css adds, as a key ss() accepts. configure({ keys }) in
// src/lib/tailess.setup.ts is its runtime half.
declare module "tailess" {
  interface CustomKeys {
    "3xl": true;
  }
}

export {};
