# ALASSAUL-AI — Destination Gallery Image Research
Date: 2026-11-06
Scope: research only; no production deployment and no change to the 40-card gallery yet.

## Recovered baseline
- The recovered `client/src/pages/Home.tsx` contains exactly 40 `DESTINATION_GALLERY` entries.
- 20 entries have an image value; 20 entries have `image: null`.
- Keep null placeholders until a place-specific image is verified. Do not substitute regional scenery or another destination's image.

## Verified place-specific image candidates
| Gallery destination | Wikimedia Commons file | Author | License | Source |
|---|---|---|---|---|
| الميدان | Trabzon Meydan Park (1).jpg | Radosław Botev | CC BY 3.0 PL | https://commons.wikimedia.org/wiki/File:Trabzon_Meydan_Park_(1).jpg |
| السلطان مراد | -Sultan -Murat -Yaylasi -uzongol -Trabzon -turkey (14252347635).jpg | Abdullah Muashi | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:-Sultan_-Murat_-Yaylasi_-uzongol_-Trabzon_-turkey_(14252347635).jpg |
| هامسي كوي وزيقانا (هامسي كوي فقط) | Hamsiköy trabzon - panoramio.jpg | bynyalcin | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Hamsik%C3%B6y_trabzon_-_panoramio.jpg |
| واجهة أوردو البحرية | Ordu sahil - panoramio.jpg | Öner Akgün | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ordu_sahil_-_panoramio.jpg |
| شاطئ فاتسا وممشى البحر | Fatsa Sahil.jpg | Eğitmen Mahmut | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Fatsa_Sahil.jpg |
| شلال كوزالان | Waterfall Kuzalan - Kuzalan Şelalesi, Giresun 2017-07-07 01-12.jpg | Zeynel Cebeci | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Waterfall_Kuzalan_-_Kuzalan_%C5%9Eelalesi,_Giresun_2017-07-07_01-12.jpg |

## Important qualification
- The Hamsiköy photograph documents Hamsiköy, not necessarily Zigana. It may only be used if the card is relabeled to Hamsiköy or the caption clearly says the image is of Hamsiköy.
- The other five listed files are explicitly titled/described for the corresponding named place.
- Attribution and license links must be retained in the gallery data for every externally hosted photograph.

## Not accepted / needs more research
- Trabzon Botanik Park: a search result named “Botanik Parkı.jpg” depicts Çankaya/Ankara, so it is rejected.
- Kaşüstü Sahil Yürüyüş Yolu, Yomra Sahil Parkı/Liman, airplane restaurant, Özdil witch-themed restaurant, Yomra highlands, Demirkapı, Arsin beach, Sürmene tea factories, Araklı waterfall, Of coast, EYOF Park, Kaşüstü mountain luge, and Trabzon Aquarium: no exact image approved in this pass.
- Arsin category includes photos labelled Yeşilyalı Arsin, but they need visual inspection to establish whether they depict the beach/promenade before use.

## Next steps
1. Download and visually inspect the six candidates at their Commons file pages.
2. Add approved image URLs plus author/source/license metadata to the corresponding gallery entries.
3. Keep every unverified entry image-null; continue place-specific searches for the remaining entries.
4. Run type-check/build and gallery duplicate/alt-text checks before any deployment.
