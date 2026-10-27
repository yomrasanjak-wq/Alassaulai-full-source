# نتائج تقييم صوت الرد العربي

المكوّن الحالي يعتمد على `SpeechSynthesis` في المتصفح، لذلك تختلف الأصوات المتاحة بين الهاتف والمتصفح ونظام التشغيل، ولا يمكن ضمان صوت ثابت باسم آدم أو خالد من دون مزود صوت خارجي.

تحسينات النسخة الحالية ترفع أولوية الأصوات التي تحمل مؤشرات رجالية عربية أو أسماء مثل Adam وKhalid وArabic Male، وتستبعد مؤشرات الأصوات النسائية عند اختيار «رجل». كما تم تنظيف Markdown من النص قبل النطق، ورفع سرعة النطق العربية إلى 1.08 مع pitch رجالي منخفض قليلاً لتقليل الإحساس بالتأخير.

للحصول على صوت عربي رجالي ثابت وطبيعي قريب من صوت الاتصالات، تشير وثائق Google Cloud Text-to-Speech الرسمية إلى أصوات عربية `ar-XA` رجالية من فئات Chirp 3 HD وNeural/WaveNet، ومنها أصوات مثل `ar-XA-Chirp3-HD-Achird` و`ar-XA-Wavenet-B`. هذا المسار يحتاج حساباً ومفتاح خدمة، وتخزين الصوت مؤقتاً أو بثه من الخادم.

وثائق OpenAI الرسمية تذكر بث الصوت وخصائص منخفضة التأخير، لكنها توضّح أن الأصوات مهيأة حالياً للإنجليزية، لذلك لا تُعد الخيار الأول لصوت عربي رجالي ثابت في هذه المنصة.

المراجع:

1. OpenAI Text to Speech: https://developers.openai.com/api/docs/guides/text-to-speech
2. Google Cloud supported voices and languages: https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
3. Azure Speech language and voice support: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
