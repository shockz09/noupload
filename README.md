# noupload

**Free, private file tools that run entirely in your browser.**

No uploads. No servers. Your files never leave your device.

---

## Why I Made This

I saw many other similar client-side PDF tools which wanted to serve as a privacy-first alternative to [ilovepdf](https://www.ilovepdf.com/) etc, cuz most of the stuff that ilovepdf does can be done client-side and it should be. But the other tools which did this client-side were hastily built and their design and UX weren't thought through properly—it felt weird to use them even though they came up with the concept first.

So I built my own with better design and UX which could actually be used in production as an alternative to ilovepdf for most of the functions.

After some days of building noupload with just PDF tools, I was randomly researching what more stuff we could do client-side. I figured out that just like we could do most of the PDF manipulation stuff client-side, we could also do the same with images, and audio too—though audio is way heavier because FFmpeg is massive, but it still works. So I built the pages for these with many tools in them. A lot of days were spent figuring out the proper flow of everything, but they both turned out pretty well and became worthy additions to noupload. Hence, noupload became a suite, and then I added QR functionality too for people who want to generate/scan/bulk generate or custom design QR codes etc. I also added Encrypt/Decrypt PDF later after figuring out about qpdf-wasm, it's amazing, allows us to do encryption and decryption client-side with ease.

**Compression**

Compression at first was just removing metadata which basically didn't do anything—it was pretty much useless. That's why the previous version of this README said PDF compression isn't up to the mark, not very good, etc. Then I researched and read up some stuff and figured that qpdf-wasm could do PDF compression, so I tried that. It didn't work that well either—qpdf can't actually recompress images, which is where most of the file size comes from.

Then I researched more and figured out that [Ghostscript](https://ghostscript.com/) is the real deal for PDF compression. I stumbled upon [Playing around with Webassembly: Ghostscript](https://meyer-laurent.com/playing-around-webassembly-and-ghostscript) by [laurentmmeyer](https://github.com/laurentmmeyer), which was such an interesting read. He built [ghostscript-pdf-compress.wasm](https://github.com/laurentmmeyer/ghostscript-pdf-compress.wasm) because he wanted a privacy-first solution for compressing his hefty bank statement PDF—he didn't want to upload sensitive documents to random online compressors. So he compiled Ghostscript to WebAssembly and made it work entirely in the browser. His work was based on [ps-wasm](https://github.com/ochachacha/ps-wasm) by [ochachacha](https://github.com/ochachacha), the original Ghostscript WASM port.

I was about to self-host from laurentmmeyer's repo, but then I found [@bentopdf/gs-wasm](https://www.npmjs.com/package/@bentopdf/gs-wasm)—a polished npm package that wraps Ghostscript WASM nicely. Tried it out, and it worked amazingly well. A 4.8MB PDF compressed to 480KB. So I merged it into main, and now noupload's PDF compression actually works—thanks to Ghostscript and all these awesome open source contributors!

**Q: Why is there a ⚡ icon, what's its purpose?**

While making this tool, I realised that for tasks like PDF → Images, it feels like friction when I upload a PDF and then still have to click "Convert" to get the images. So I experimented with this new UX where enabling this mode removes one layer of friction—for tasks where it makes sense, it just gets straight to the result without that extra click.

I added this to pages which actually allowed it, because obviously you can't remove this friction everywhere. Like for Images → PDF, we can't know when the user is done uploading all the pages they want, but for PDF → Images, we know there's one PDF uploaded so we can skip straight to converting. Another example is HEIC → JPEG in the image tools—just upload and get your JPEG. Same with Strip Metadata—upload the image and it's done, no need for a useless "Remove Metadata" button click.

This works well because everything is processed client-side anyway, so there's no risk of your file going somewhere by mistake—it never leaves your device.

I would love if people would contribute and use this.

---

## Features

### PDF Tools

Merge, Split, Compress (Ghostscript), Organize, Rotate, Watermark, Page Numbers, Sign, OCR, Grayscale, Encrypt, Decrypt, Sanitize, PDF to Images, Images to PDF, PDF to Text, PDF to EPUB, PDF to PDF/A, HTML to PDF, Markdown to PDF, PPTX to PDF, Extract Images, Reverse Pages, Duplicate Pages, Delete Pages, Edit Metadata

### Image Tools

Compress, Resize, Convert, Crop, Rotate, Blur & Pixelate, Border, Watermark, Adjust (brightness/contrast/saturation), Filters, Beautify, Collage, Color Palette, Remove Background, Edit, Strip Metadata, To Base64, Screenshot, Favicon Generator, HEIC to JPEG

### Video Tools

Trim, Compress, Convert, Crop, Rotate, Resize, Remove Audio, Extract Audio, To GIF, View Metadata

### Audio Tools

Trim, Compress, Convert, Merge, Fade, Speed, Volume, Normalize, Denoise, Remove Silence, Reverse, Waveform, Record, Edit Metadata

### QR Code Tools

Generate, Scan, Bulk Generate, Barcode Generator

---

## Tech Stack

- [Vite](https://vite.dev/) — Build tool
- [TanStack Router](https://tanstack.com/router) — Type-safe routing
- [React 19](https://react.dev/) — UI library
- [Tailwind CSS 4](https://tailwindcss.com/) — Styling
- [shadcn/ui](https://ui.shadcn.com/) — UI components
- [pdf-lib](https://pdf-lib.js.org/) — PDF manipulation
- [react-pdf](https://github.com/wojtekmaj/react-pdf) (PDF.js) — PDF rendering
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR engine
- [Mediabunny](https://mediabunny.dev/) — Video processing (WebCodecs)
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) — Audio processing
- [gifenc](https://github.com/mattdesl/gifenc) — GIF encoding
- [fflate](https://github.com/101arrowz/fflate) — ZIP compression
- [qrcode](https://github.com/soldair/node-qrcode) — QR code generation
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) — QR code scanning
- [heic-decode](https://github.com/nicolo-ribaudo/heic-decode) — HEIC conversion
- [html-to-image](https://github.com/bubkoo/html-to-image) — Screenshot capture
- [qpdf-wasm](https://github.com/neslinesli93/qpdf-wasm) — PDF encryption/decryption
- [@bentopdf/gs-wasm](https://www.npmjs.com/package/@bentopdf/gs-wasm) — PDF compression (Ghostscript WASM)

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/shockz09/noupload.git
cd noupload

# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173)

## Building for Production

```bash
pnpm build
pnpm preview
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/awesome`)
3. Commit your changes (`git commit -m 'Add awesome feature'`)
4. Push to the branch (`git push origin feature/awesome`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE)

---

## Acknowledgments

Built with these amazing open source libraries:

- [pdf-lib](https://github.com/Hopding/pdf-lib) — PDF creation and modification
- [PDF.js](https://github.com/mozilla/pdf.js) — PDF rendering
- [Tesseract.js](https://github.com/naptha/tesseract.js) — OCR engine
- [Mediabunny](https://github.com/nickkies/mediabunny) — Hardware-accelerated video processing
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) — Audio processing
- [gifenc](https://github.com/mattdesl/gifenc) — Pure JS GIF encoding
- [fflate](https://github.com/101arrowz/fflate) — Fast ZIP compression
- [shadcn/ui](https://github.com/shadcn-ui/ui) — Beautiful UI components
- [qrcode](https://github.com/soldair/node-qrcode) — QR code generation
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) — QR code scanning
- [heic-decode](https://github.com/catdad-experiments/heic-decode) — HEIC to JPEG conversion
- [html-to-image](https://github.com/bubkoo/html-to-image) — DOM to image conversion
- [qpdf-wasm](https://github.com/neslinesli93/qpdf-wasm) — PDF encryption/decryption
- [@bentopdf/gs-wasm](https://www.npmjs.com/package/@bentopdf/gs-wasm) — PDF compression (Ghostscript WASM)
