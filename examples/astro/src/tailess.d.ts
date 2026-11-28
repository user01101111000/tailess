// The breakpoint src/styles/global.css adds, as a key ss() accepts. configure({ keys }) in
// src/tailess.setup.ts is its runtime half.
declare module "tailess" {
  interface CustomKeys {
    "3xl": true;
  }
}

export {};
