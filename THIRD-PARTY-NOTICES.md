# Third-party notices

PaidFlow includes Tesseract4Android 4.9.0 and English/Russian trained data from the Tesseract OCR project.

- Tesseract4Android and the Tesseract, Leptonica, libjpeg and libpng components are distributed under their respective licenses. Tesseract4Android's notice and license are available at <https://github.com/adaptech-cz/Tesseract4Android/blob/master/LICENSE>.
- The `eng.traineddata` and `rus.traineddata` files are downloaded by `scripts/prepare-tessdata.sh` from the Tesseract OCR project's `tessdata_fast` repository, pinned to commit `87416418657359cb625c412a48b6e1d6d41c29bd`. That repository is licensed under Apache License 2.0: <https://github.com/tesseract-ocr/tessdata_fast/blob/main/LICENSE>.

OCR runs locally on the device. PaidFlow does not send invoice images or recognized text to a server.
