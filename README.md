# PDF0

**Free, private PDF tools that run entirely in your browser.**

No uploads. No servers. No tracking. Your files never leave your device.

---

## Why I Made This

I saw many other similar client-side PDF tools which wanted to serve as a privacy-first alternative to [ilovepdf](https://www.ilovepdf.com/) etc, cuz most of the stuff that ilovepdf does can be done client-side and it should be. But the other tools which did this client-side were hastily built and their design and UX weren't thought through properly—it felt weird to use them even though they came up with the concept first.

So I built my own with better design and UX which could actually be used in production as an alternative to ilovepdf for most of the functions, except some. Compression isn't the best because true PDF compression requires re-encoding images and fonts with native libraries that don't run well in browsers—so don't expect massive size reductions on image-heavy PDFs.

I would love if people would contribute and use this.

---

## Features

| Tool | Description |
|------|-------------|
| **Organize** | Drag & drop to reorder, add, or delete pages |
| **Merge** | Combine multiple PDFs into one |
| **Split** | Extract pages or divide into multiple files |
| **Compress** | Reduce file size (metadata removal, structure optimization) |
| **Rotate** | Rotate pages in any direction |
| **Watermark** | Add text watermarks to documents |
| **Page Numbers** | Add page numbers to your PDF |
| **Sign** | Draw or upload your signature |
| **OCR** | Extract text from scanned documents |
| **PDF → Images** | Convert pages to JPG or PNG |
| **Images → PDF** | Create a PDF from images |

## Tech Stack

- [Next.js 15](https://nextjs.org/) — React framework
- [pdf-lib](https://pdf-lib.js.org/) — PDF manipulation
- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF rendering
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR engine
- [Tailwind CSS](https://tailwindcss.com/) — Styling

## Getting Started

```bash
# Clone the repo
git clone https://github.com/shockz09/pdf0.git
cd pdf0

# Install dependencies
bun install

# Start dev server
bun dev
```

Open [http://localhost:3000](http://localhost:3000)

## Building for Production

```bash
bun run build
bun start
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/awesome`)
3. Commit your changes (`git commit -m 'Add awesome feature'`)
4. Push to the branch (`git push origin feature/awesome`)
5. Open a Pull Request

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgments

Built with these open source libraries:
- [pdf-lib](https://github.com/Hopding/pdf-lib)
- [PDF.js](https://github.com/nicolo-ribaudo/pdfjs-dist)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
