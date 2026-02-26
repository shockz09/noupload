import { ZetaHelperThread } from "/vendor/zetajs/zetaHelper.js";

const zHT = new ZetaHelperThread();
const zetajs = zHT.zetajs;
const css = zHT.css;

let xModel;

const bean_hidden = new css.beans.PropertyValue({
  Name: "Hidden",
  Value: true,
});
const bean_overwrite = new css.beans.PropertyValue({
  Name: "Overwrite",
  Value: true,
});
const bean_pdf_export = new css.beans.PropertyValue({
  Name: "FilterName",
  Value: "writer_pdf_Export",
});

zHT.thrPort.onmessage = (e) => {
  switch (e.data.cmd) {
    case "convert":
      try {
        // Close previous document if any
        if (xModel !== undefined) {
          try {
            const closeable = xModel.queryInterface(
              zetajs.type.interface(css.util.XCloseable)
            );
            if (closeable) closeable.close(false);
          } catch (_) {
            // ignore close errors
          }
          xModel = undefined;
        }

        xModel = zHT.desktop.loadComponentFromURL(
          "file://" + e.data.from,
          "_blank",
          0,
          [bean_hidden]
        );

        xModel.storeToURL("file://" + e.data.to, [
          bean_overwrite,
          bean_pdf_export,
        ]);

        zetajs.mainPort.postMessage({
          cmd: "converted",
          name: e.data.name,
          from: e.data.from,
          to: e.data.to,
        });
      } catch (err) {
        let message = String(err);
        try {
          const exc = zetajs.catchUnoException(err);
          if (exc && exc.Message) message = exc.Message;
        } catch (_) {
          // not a UNO exception
        }
        zetajs.mainPort.postMessage({ cmd: "error", message });
      }
      break;
  }
};

// Signal ready
zHT.thrPort.postMessage({ cmd: "start" });
