// The breakpoint app/assets/css/main.css adds, as a key ss() accepts. configure({ keys })
// in app/tailess.setup.ts is its runtime half.
declare module "tailess" {
  interface CustomKeys {
    "3xl": true;
  }
}

export {};
