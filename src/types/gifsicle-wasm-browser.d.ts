declare module "gifsicle-wasm-browser" {
  interface GifsicleInput {
    file: File | Blob | ArrayBuffer | string;
    name: string;
  }

  interface GifsicleRunOptions {
    input: GifsicleInput[];
    command: string[];
    folder?: string[];
    isStrict?: boolean;
  }

  interface Gifsicle {
    run(options: GifsicleRunOptions): Promise<File[]>;
  }

  const gifsicle: Gifsicle;
  export default gifsicle;
}
