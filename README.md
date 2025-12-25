# PDF0

**Free, private PDF tools that run entirely in your browser.**

No uploads. No servers. No tracking. Your files never leave your device.

## Features

| Tool | Description |
|------|-------------|
| **Organize** | Drag & drop to reorder, add, or delete pages |
| **Merge** | Combine multiple PDFs into one |
| **Split** | Extract pages or divide into multiple files |
| **Compress** | Reduce file size while keeping quality |
| **Rotate** | Rotate pages in any direction |
| **Watermark** | Add text watermarks to documents |
| **Page Numbers** | Add page numbers to your PDF |
| **Sign** | Draw or upload your signature |
| **OCR** | Extract text from scanned documents |
| **PDF → Images** | Convert pages to JPG or PNG |
| **Images → PDF** | Create a PDF from images |

## Why LocalPDF?

- **Privacy First** — All processing happens in your browser using WebAssembly and JavaScript. We literally can't see your files.
- **No Upload Wait** — Processing starts instantly. No waiting for uploads/downloads.
- **Works Offline** — Once loaded, works without internet.
- **Free Forever** — No accounts, no subscriptions, no limits.

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

Built with these amazing open source libraries:
- [pdf-lib](https://github.com/Hopding/pdf-lib)
- [PDF.js](https://github.com/nicolo-ribaudo/pdfjs-dist)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
