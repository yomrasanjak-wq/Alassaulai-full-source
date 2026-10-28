import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Filter, MapPin, Navigation, Search, Sparkles, X } from "lucide-react";
import { MapView } from "@/components/Map";

type MapCategory = "all" | "cities" | "nature" | "culture" | "family";

type MapDestination = {
  name: string;
  latin: string;
  category: Exclude<MapCategory, "all">;
  label: string;
  note: string;
  query: string;
  city: string;
  branch: string;
  position: google.maps.LatLngLiteral;
};

const destinations: MapDestination[] = [
  { name: "يومرا", city: "يومرا", branch: "الساحل والخدمات", latin: "Yomra", category: "cities", label: "بلدة ساحلية", note: "منطقة ساحلية شرقي طرابزون تضم أحياء سكنية ومراكز تسوق ومطاعم.", query: "Yomra Trabzon Turkey", position: { lat: 40.956, lng: 39.855 } },
  { name: "أرسين", city: "أرسين", branch: "الساحل والخدمات", latin: "Arsin", category: "cities", label: "ساحل البحر الأسود", note: "بلدة ساحلية شرقي طرابزون؛ تحقق من ساعات عمل الخدمات قبل التوجه.", query: "Arsin Trabzon Turkey", position: { lat: 40.952, lng: 39.93 } },
  { name: "سورميني", city: "سورميني", branch: "الساحل والقرى", latin: "Sürmene", category: "cities", label: "بلدة ساحلية", note: "بلدة على ساحل البحر الأسود شرقي طرابزون، على الطريق باتجاه ريزا.", query: "Surmene Trabzon Turkey", position: { lat: 40.906, lng: 40.116 } },
  { name: "أراكلي", city: "أراكلي", branch: "الساحل والقرى", latin: "Araklı", category: "cities", label: "ساحل وبلدة", note: "بلدة ساحلية شرقي طرابزون ضمن مسار الطريق الساحلي إلى ريزا.", query: "Arakli Trabzon Turkey", position: { lat: 40.939, lng: 40.058 } },
  { name: "واجهة كاشستوس البحرية", city: "يومرا", branch: "الساحل والخدمات", latin: "Kaşüstü Waterfront", category: "family", label: "واجهة بحرية", note: "منطقة ساحلية قرب يومرا؛ تحقق من المداخل والخدمات المتاحة قبل الزيارة.", query: "Kasustu Yomra Trabzon Turkey", position: { lat: 40.958, lng: 39.856 } },
  { name: "مركز جواهر طرابزون", city: "يومرا", branch: "الساحل والخدمات", latin: "Cevahir Outlet Trabzon", category: "family", label: "تسوق ومطاعم", note: "مركز تسوق في منطقة يومرا؛ تحقق من ساعات العمل والفعاليات قبل الانطلاق.", query: "Cevahir Outlet Trabzon Yomra Turkey", position: { lat: 40.957, lng: 39.862 } },
  { name: "حديقة ساحل أرسين", city: "أرسين", branch: "الساحل والخدمات", latin: "Arsin Sahil Parkı", category: "family", label: "حديقة ساحلية", note: "مساحة ساحلية للتنزه؛ قد تتغير الخدمات المتاحة حسب الموسم والطقس.", query: "Arsin Sahil Parki Trabzon Turkey", position: { lat: 40.953, lng: 39.927 } },
  { name: "مركز سورميني", city: "سورميني", branch: "الساحل والقرى", latin: "Sürmene Center", category: "cities", label: "أسواق وخدمات", note: "مركز البلدة على الطريق الساحلي؛ استخدم الخريطة للتحقق من الوجهة وساعات العمل.", query: "Surmene merkez Trabzon Turkey", position: { lat: 40.912, lng: 40.116 } },
  { name: "محال سكاكين سورميني", city: "سورميني", branch: "الساحل والقرى", latin: "Sürmene Knife Shops", category: "culture", label: "حرف محلية وتسوق", note: "تشتهر سورميني بحرفة صناعة السكاكين؛ تحقق من المتجر ومواعيد العمل قبل الزيارة.", query: "Surmene bicak dukkanlari Turkey", position: { lat: 40.912, lng: 40.118 } },
  { name: "شلالات أراكلي", city: "أراكلي", branch: "الساحل والقرى", latin: "Araklı Waterfalls", category: "nature", label: "طبيعة وشلالات", note: "وجهة طبيعية في ريف أراكلي؛ افحص حالة الطريق والطقس قبل الانطلاق.", query: "Arakli waterfalls Trabzon Turkey", position: { lat: 40.73, lng: 40.05 } },
  { name: "طرابزون", city: "طرابزون", branch: "المدينة والساحل", latin: "Trabzon", category: "cities", label: "مدينة ساحلية", note: "بوابة البحر الأسود والأسواق والمطاعم والميناء.", query: "Trabzon Turkey", position: { lat: 41.0053, lng: 39.7225 } },
  { name: "أوزنجول", city: "طرابزون", branch: "سلطان مراد · أوزنجول · ديمركابي", latin: "Uzungöl", category: "nature", label: "بحيرة وقرية", note: "بحيرة جبلية ومسارات هادئة وإطلالات لا تنسى.", query: "Uzungol Trabzon Turkey", position: { lat: 40.6197, lng: 40.2958 } },
  { name: "ريزا", city: "ريزا", branch: "المدينة والساحل", latin: "Rize", category: "cities", label: "مدينة الشاي", note: "مزارع الشاي والمرتفعات والهواء البحري.", query: "Rize Turkey", position: { lat: 41.0201, lng: 40.5234 } },
  { name: "أيدر", city: "ريزا", branch: "الطبيعة والمرتفعات", latin: "Ayder", category: "nature", label: "مرتفعات وشلالات", note: "غابات وشلالات وينابيع في قلب الطبيعة.", query: "Ayder Plateau Turkey", position: { lat: 40.9527, lng: 41.0931 } },
  { name: "دير سوميلا", city: "طرابزون", branch: "سوميلا · همسي كوي · حاجي مصطفى · زيغانا", latin: "Sümela", category: "culture", label: "تاريخ وثقافة", note: "دير تاريخي معلق بين الجبال ومسار مذهل.", query: "Sumela Monastery Turkey", position: { lat: 40.6898, lng: 39.6585 } },
  { name: "أوردو", city: "أوردو", branch: "المدينة والساحل", latin: "Ordu", category: "cities", label: "ساحل وتلفريك", note: "واجهة بحرية وتلفريك وإطلالة بانورامية.", query: "Ordu Turkey", position: { lat: 40.9839, lng: 37.8764 } },
  { name: "همسي كوي", city: "طرابزون", branch: "سوميلا · همسي كوي · حاجي مصطفى · زيغانا", latin: "Hamsiköy", category: "family", label: "قرية ومذاق", note: "طريق جبلي وقرية هادئة وتجربة محلية للعائلة.", query: "Hamsikoy Trabzon Turkey", position: { lat: 40.8218, lng: 39.4576 } },
  { name: "سامسون", city: "سامسون", branch: "المدينة والساحل", latin: "Samsun", category: "cities", label: "مدينة ساحلية", note: "كورنيش واسع ومتاحف وحدائق على البحر الأسود.", query: "Samsun Turkey", position: { lat: 41.2867, lng: 36.33 } },
  { name: "أتاكوم", city: "سامسون", branch: "المدينة والساحل", latin: "Atakum", category: "family", label: "شاطئ وممشى", note: "ممشى أتاكوم ومقاهٍ وإطلالة بحرية للعائلة.", query: "Atakum Samsun Turkey", position: { lat: 41.33, lng: 36.28 } },
  { name: "جيرسون", city: "جيرسون", branch: "المدينة والمرتفعات", latin: "Giresun", category: "cities", label: "جزيرة وقلعة", note: "مدينة ساحلية وقلعة وجزيرة تاريخية.", query: "Giresun Turkey", position: { lat: 40.9128, lng: 38.3895 } },
  { name: "كومبيت", city: "جيرسون", branch: "المدينة والمرتفعات", latin: "Kümbet", category: "nature", label: "مرتفعات", note: "مرتفعات خضراء وهواء بارد ومسارات طبيعية.", query: "Kumbet Plateau Giresun Turkey", position: { lat: 40.65, lng: 38.35 } },
  { name: "أنقرة", city: "أنقرة", branch: "المدينة والمعالم", latin: "Ankara", category: "cities", label: "عاصمة وتاريخ", note: "العاصمة والمتاحف والقلعة والأسواق الحديثة.", query: "Ankara Turkey", position: { lat: 39.9334, lng: 32.8597 } },
  { name: "إسطنبول", city: "إسطنبول", branch: "المدينة والمعالم", latin: "Istanbul", category: "cities", label: "البوسفور", note: "البوسفور والمعالم التاريخية والأسواق العريقة.", query: "Istanbul Turkey", position: { lat: 41.0082, lng: 28.9784 } },
  { name: "يالوا", city: "يالوا", branch: "المدينة والواجهة البحرية", latin: "Yalova", category: "cities", label: "مدينة ساحلية", note: "واجهة بحرية وحدائق ومقاهٍ على بحر مرمرة.", query: "Yalova Turkey", position: { lat: 40.655, lng: 29.276 } },
  { name: "حمامات يالوا الحرارية", city: "يالوا", branch: "الطبيعة والاستجمام", latin: "Yalova Thermal Springs", category: "nature", label: "ينابيع حرارية", note: "منطقة ينابيع حرارية وحدائق خضراء؛ تحقق من ساعات العمل قبل الزيارة.", query: "Yalova Termal Kaplicalari Turkey", position: { lat: 40.606, lng: 29.17 } },
  { name: "قصر يورويان كوشك", city: "يالوا", branch: "المدينة والتاريخ", latin: "Yuruyen Kosk", category: "culture", label: "معلم تاريخي", note: "قصر صغير معروف على الواجهة البحرية لمدينة يالوا.", query: "Yuruyen Kosk Yalova Turkey", position: { lat: 40.659, lng: 29.276 } },
  { name: "شلال صودوشن", city: "يالوا", branch: "الطبيعة والاستجمام", latin: "Sudusen Waterfall", category: "nature", label: "شلال وغابة", note: "وجهة طبيعية في ريف يالوا؛ افحص حالة الطريق والطقس قبل الانطلاق.", query: "Sudusen Waterfall Yalova Turkey", position: { lat: 40.57, lng: 29.14 } },
  { name: "صبنجا", city: "صبنجا", branch: "البحيرة والواجهة", latin: "Sapanca", category: "cities", label: "بحيرة ومدينة", note: "بحيرة شهيرة للتنزه والمقاهي والإقامة الهادئة.", query: "Sapanca Lake Sakarya Turkey", position: { lat: 40.691, lng: 30.267 } },
  { name: "بحيرة صبنجة", city: "صبنجا", branch: "البحيرة والواجهة", latin: "Sapanca Lake", category: "nature", label: "بحيرة وممشى", note: "واجهة البحيرة مناسبة للتنزه والتصوير؛ تختلف الأنشطة حسب الموسم.", query: "Sapanca Lake Turkey", position: { lat: 40.701, lng: 30.25 } },
  { name: "قرية معشوقية", city: "صبنجا", branch: "الطبيعة والمطاعم", latin: "Masukiye", category: "family", label: "قرية ومطاعم ريفية", note: "منطقة خضراء تشتهر بالمطاعم والرحلات القصيرة قرب كارتبه.", query: "Masukiye Kartepe Turkey", position: { lat: 40.69, lng: 30.14 } },
  { name: "كارتبه", city: "كارتبه", branch: "المرتفعات والثلوج", latin: "Kartepe", category: "cities", label: "مرتفعات", note: "وجهة جبلية موسمية للمناظر الطبيعية والأنشطة الشتوية.", query: "Kartepe Kocaeli Turkey", position: { lat: 40.697, lng: 30.11 } },
  { name: "قمة كارتبه", city: "كارتبه", branch: "المرتفعات والثلوج", latin: "Kartepe Summit", category: "nature", label: "قمة وإطلالات", note: "إطلالات جبلية؛ قد تتغير إمكانية الوصول وفق الطقس والموسم.", query: "Kartepe Ski Center Turkey", position: { lat: 40.70, lng: 30.08 } },
  { name: "منتزه أورمانيا", city: "كارتبه", branch: "الطبيعة والعائلة", latin: "Ormanya", category: "family", label: "منتزه عائلي", note: "منتزه طبيعي واسع ومناسب للعائلات قرب كوجالي.", query: "Ormanya Natural Life Park Kocaeli Turkey", position: { lat: 40.70, lng: 30.03 } },
  { name: "بورصة", city: "بورصة", branch: "المدينة والأسواق", latin: "Bursa", category: "cities", label: "مدينة تاريخية", note: "أسواق عثمانية ومعالم تاريخية وبوابة إلى جبل أولوداغ.", query: "Bursa Turkey", position: { lat: 40.195, lng: 29.06 } },
  { name: "الجامع الكبير في بورصة", city: "بورصة", branch: "التاريخ والأسواق", latin: "Bursa Grand Mosque", category: "culture", label: "جامع تاريخي", note: "من أبرز معالم بورصة التاريخية في مركز المدينة.", query: "Bursa Ulu Cami Turkey", position: { lat: 40.184, lng: 29.061 } },
  { name: "خان الحرير كوزا هان", city: "بورصة", branch: "التاريخ والأسواق", latin: "Koza Han", category: "culture", label: "سوق تاريخي", note: "خان تاريخي معروف بالتسوق والمنتجات الحريرية.", query: "Koza Han Bursa Turkey", position: { lat: 40.184, lng: 29.063 } },
  { name: "جبل أولوداغ", city: "بورصة", branch: "الجبال والتلفريك", latin: "Uludag", category: "nature", label: "جبل وتلفريك", note: "وجهة جبلية للمناظر والأنشطة الموسمية؛ تحقق من حالة التلفريك والطقس.", query: "Uludag National Park Bursa Turkey", position: { lat: 40.07, lng: 29.22 } },
  { name: "ساكاريا", city: "ساكاريا", branch: "المدينة والطبيعة", latin: "Sakarya", category: "cities", label: "مدينة وريف", note: "مدينة ومحيط طبيعي يضم بحيرات وحدائق ووجهات ريفية.", query: "Adapazari Sakarya Turkey", position: { lat: 40.773, lng: 30.403 } },
  { name: "بحيرة بويرازلار", city: "ساكاريا", branch: "المدينة والطبيعة", latin: "Poyrazlar Lake", category: "nature", label: "بحيرة وحديقة طبيعية", note: "منطقة طبيعية للتنزه والتصوير قرب ساكاريا.", query: "Poyrazlar Golu Sakarya Turkey", position: { lat: 40.84, lng: 30.43 } },
  { name: "جسر جوستينيانوس", city: "ساكاريا", branch: "التاريخ والمعالم", latin: "Justinian Bridge", category: "culture", label: "جسر تاريخي", note: "جسر تاريخي أثري في محيط ساكاريا.", query: "Sangarius Bridge Sakarya Turkey", position: { lat: 40.76, lng: 30.35 } },
  { name: "إزميت", city: "إزميت", branch: "المدينة والواجهة البحرية", latin: "Izmit", category: "cities", label: "مدينة على خليج إزميت", note: "مركز حضري على بحر مرمرة مع واجهة بحرية ومتاحف وحدائق.", query: "Izmit Kocaeli Turkey", position: { lat: 40.766, lng: 29.916 } },
  { name: "برج ساعة إزميت", city: "إزميت", branch: "التاريخ والواجهة البحرية", latin: "Izmit Clock Tower", category: "culture", label: "معلم تاريخي", note: "برج ساعة تاريخي يطل على منطقة الخليج.", query: "Izmit Clock Tower Turkey", position: { lat: 40.765, lng: 29.92 } },
  { name: "حديقة سيكابارك", city: "إزميت", branch: "الطبيعة والعائلة", latin: "Sekapark", category: "family", label: "حديقة وممشى", note: "مساحات خضراء وممشى على الواجهة البحرية.", query: "Sekapark Izmit Turkey", position: { lat: 40.758, lng: 29.93 } },
  { name: "أولاشلي", city: "أولاشلي", branch: "الساحل والقرى", latin: "Ulasli, Golcuk", category: "cities", label: "بلدة ساحلية", note: "منطقة ساحلية تابعة لغولجوك في ولاية كوجالي على خليج إزميت.", query: "Ulasli Golcuk Kocaeli Turkey", position: { lat: 40.694, lng: 29.75 } },
  { name: "ساحل أولاشلي", city: "أولاشلي", branch: "الساحل والقرى", latin: "Ulasli Sahili", category: "nature", label: "واجهة بحرية", note: "واجهة ساحلية محلية للتنزه؛ تحقق من الخدمات المتاحة ميدانيًا.", query: "Ulasli Sahili Golcuk Turkey", position: { lat: 40.694, lng: 29.752 } },
  { name: "دغرمندره", city: "أولاشلي", branch: "الساحل والقرى", latin: "Degirmendere", category: "family", label: "بلدة ساحلية قريبة", note: "واجهة بحرية ومقاهٍ في محيط غولجوك، مناسبة لإضافة محطة قريبة للرحلة.", query: "Degirmendere Golcuk Kocaeli Turkey", position: { lat: 40.712, lng: 29.78 } },
  { name: "باتومي", city: "جورجيا", branch: "المدينة والواجهة البحرية", latin: "Batumi", category: "cities", label: "ساحل جورجيا", note: "بوليفارد باتومي والحدائق والواجهة البحرية.", query: "Batumi Georgia", position: { lat: 41.6168, lng: 41.6367 } },
  { name: "مرتفعات يومرا", city: "طرابزون", branch: "مرتفعات يومرا", latin: "Yomra", category: "nature", label: "مرتفعات وإطلالات", note: "إطلالات بحرية ومرافق ترفيهية قريبة من طرابزون.", query: "Yomra Trabzon Turkey", position: { lat: 40.955, lng: 39.86 } },
  { name: "مرتفعات سلطان مراد", city: "طرابزون", branch: "سلطان مراد · أوزنجول · ديمركابي", latin: "Sultan Murat", category: "nature", label: "مرتفعات", note: "مروج جبلية وإطلالات موسمية لعشاق الطبيعة.", query: "Sultan Murat Plateau Trabzon Turkey", position: { lat: 40.74, lng: 40.18 } },
  { name: "أكشبات", city: "طرابزون", branch: "أكشبات · حيدر نبي · مغارة تشال · كاياباشا · حاجي", latin: "Akçaabat", category: "family", label: "ساحل ومرتفعات", note: "شاطئ وممشى أكشبات ومرتفعات حيدر نبي ومغارة تشال.", query: "Akcaabat Trabzon Turkey", position: { lat: 41.02, lng: 39.57 } },
  { name: "مرتفعات حيدر نبي", city: "طرابزون", branch: "أكشبات · حيدر نبي · مغارة تشال · كاياباشا · حاجي", latin: "Hıdırnebi", category: "nature", label: "مرتفعات", note: "مرتفعات خضراء وإطلالات واسعة قرب أكشبات.", query: "Hidirnebi Plateau Trabzon Turkey", position: { lat: 40.99, lng: 39.49 } },
  { name: "مغارة تشال", city: "طرابزون", branch: "أكشبات · حيدر نبي · مغارة تشال · كاياباشا · حاجي", latin: "Çal Cave", category: "nature", label: "مغارة طبيعية", note: "من أطول المغارات السياحية ومشهد طبيعي مختلف.", query: "Cal Cave Trabzon Turkey", position: { lat: 40.86, lng: 39.38 } },
  { name: "بحيرة سيرا جول", city: "طرابزون", branch: "بحيرة سيرا جول", latin: "Sera Gölü", category: "nature", label: "بحيرة وأنشطة", note: "بحيرة هادئة مع ممشى وأنشطة وإطلالة جبلية.", query: "Sera Lake Trabzon Turkey", position: { lat: 40.99, lng: 39.58 } },
  { name: "كاياباشا", city: "طرابزون", branch: "أكشبات · حيدر نبي · مغارة تشال · كاياباشا · حاجي", latin: "Kayabaşı", category: "nature", label: "مرتفعات", note: "طبيعة جبلية ومراعي خضراء في ريف طرابزون.", query: "Kayabasi Trabzon Turkey", position: { lat: 40.9, lng: 39.5 } },
  { name: "ثلاث شلالات أركلي", city: "طرابزون", branch: "ثلاث شلالات أركلي", latin: "Araklı Waterfalls", category: "nature", label: "شلالات", note: "مسار طبيعي يضم ثلاثة شلالات في ريف أركلي.", query: "Arakli Waterfalls Trabzon Turkey", position: { lat: 40.73, lng: 40.05 } },
  { name: "ميدان طرابزون", city: "طرابزون", branch: "المدينة والأسواق", latin: "Meydan", category: "cities", label: "أسواق ومطاعم", note: "قلب طرابزون النابض بالمقاهي والأسواق والمطاعم.", query: "Trabzon Meydan Turkey", position: { lat: 41.002, lng: 39.716 } },
  { name: "مول جواهر طرابزون", city: "طرابزون", branch: "المدينة والأسواق", latin: "Cevahir Mall", category: "family", label: "تسوق وترفيه", note: "مول عائلي ومطاعم ومتاجر على طريق يومرا.", query: "Cevahir Outlet Trabzon Turkey", position: { lat: 40.976, lng: 39.833 } },
  { name: "حديقة زاغنوس", city: "طرابزون", branch: "المدينة والأسواق", latin: "Zağnos Valley", category: "family", label: "حديقة وممشى", note: "حديقة خضراء وممشى قريب من المعالم التاريخية.", query: "Zagnos Valley Park Trabzon Turkey", position: { lat: 41.003, lng: 39.715 } },
  { name: "قرية شكرسو", city: "ريزا", branch: "القرى والمرتفعات", latin: "Şenyuva", category: "nature", label: "قرية وجسور", note: "قرية جبلية وجسور حجرية وإطلالات على الوادي.", query: "Sen yuva Camlihemsin Rize Turkey", position: { lat: 41.007, lng: 41.038 } },
  { name: "وادي فرتينا", city: "ريزا", branch: "القرى والمرتفعات", latin: "Fırtına Valley", category: "nature", label: "نهر ومغامرات", note: "وادي أخضر وأنشطة نهرية ومسارات طبيعية.", query: "Firtina Valley Rize Turkey", position: { lat: 41.015, lng: 41.087 } },
  { name: "شلال بالوفيت", city: "ريزا", branch: "الشلالات والطبيعة", latin: "Palovit Waterfall", category: "nature", label: "شلال", note: "شلال قوي وسط غابات ريزا الكثيفة.", query: "Palovit Waterfall Rize Turkey", position: { lat: 41.034, lng: 41.083 } },
  { name: "تلفريك بوزتبه", city: "أوردو", branch: "الساحل والتلفريك", latin: "Boztepe Cable Car", category: "family", label: "تلفريك وإطلالة", note: "إطلالة بانورامية على مدينة أوردو والبحر.", query: "Ordu Boztepe Cable Car Turkey", position: { lat: 40.99, lng: 37.87 } },
  { name: "شاطئ أوردو", city: "أوردو", branch: "الساحل والتلفريك", latin: "Ordu Coast", category: "family", label: "شاطئ وممشى", note: "واجهة بحرية وممشى مناسب للعائلة.", query: "Ordu coast Turkey", position: { lat: 40.985, lng: 37.89 } },
  { name: "شلالات أوردو", city: "أوردو", branch: "الطبيعة والمرتفعات", latin: "Ordu Waterfalls", category: "nature", label: "شلالات", note: "ممرات طبيعية وشلالات في ريف أوردو.", query: "Ordu waterfalls Turkey", position: { lat: 40.78, lng: 37.78 } },
  { name: "متحف سامسون", city: "سامسون", branch: "المدينة والتاريخ", latin: "Samsun Museum", category: "culture", label: "تاريخ وثقافة", note: "متحف ومعالم تحكي تاريخ البحر الأسود.", query: "Samsun Museum Turkey", position: { lat: 41.286, lng: 36.333 } },
  { name: "بانديرما فابور", city: "سامسون", branch: "المدينة والتاريخ", latin: "Bandırma Vapuru", category: "culture", label: "معلم تاريخي", note: "سفينة ومتحف على الواجهة البحرية.", query: "Bandirma Vapuru Museum Samsun Turkey", position: { lat: 41.300, lng: 36.330 } },
  { name: "بحيرة أكالان", city: "سامسون", branch: "الطبيعة والبحيرات", latin: "Akoluk", category: "nature", label: "بحيرة وطبيعة", note: "مساحات هادئة للتنزه والتصوير خارج المدينة.", query: "Samsun lake nature Turkey", position: { lat: 41.25, lng: 36.48 } },
  { name: "جزيرة جيرسون", city: "جيرسون", branch: "الساحل والجزر", latin: "Giresun Island", category: "culture", label: "جزيرة تاريخية", note: "جزيرة ساحلية نادرة وقصص تاريخية في البحر الأسود.", query: "Giresun Island Turkey", position: { lat: 40.900, lng: 38.400 } },
  { name: "قلعة جيرسون", city: "جيرسون", branch: "الساحل والجزر", latin: "Giresun Castle", category: "culture", label: "قلعة وإطلالة", note: "قلعة وإطلالة واسعة على البحر والمدينة.", query: "Giresun Castle Turkey", position: { lat: 40.917, lng: 38.388 } },
  { name: "مرتفعات تامدير", city: "جيرسون", branch: "الطبيعة والمرتفعات", latin: "Tamdere", category: "nature", label: "مرتفعات", note: "مروج وغابات ومسارات في ريف جيرسون.", query: "Tamdere Giresun Turkey", position: { lat: 40.600, lng: 38.200 } },
  { name: "قلعة أنقرة", city: "أنقرة", branch: "التاريخ والمتاحف", latin: "Ankara Castle", category: "culture", label: "قلعة وتاريخ", note: "إطلالة تاريخية وأزقة وأسواق قديمة.", query: "Ankara Castle Turkey", position: { lat: 39.949, lng: 32.862 } },
  { name: "ضريح أتاتورك", city: "أنقرة", branch: "التاريخ والمتاحف", latin: "Anıtkabir", category: "culture", label: "معلم وطني", note: "أحد أشهر المعالم الوطنية في العاصمة.", query: "Anitkabir Ankara Turkey", position: { lat: 39.925, lng: 32.837 } },
  { name: "بحيرة إيمير", city: "أنقرة", branch: "الحدائق والبحيرات", latin: "Eymir Lake", category: "nature", label: "بحيرة وممشى", note: "بحيرة هادئة ومسارات للدراجات والتنزه.", query: "Eymir Lake Ankara Turkey", position: { lat: 39.822, lng: 32.800 } },
  { name: "قصر طوب قابي", city: "إسطنبول", branch: "التاريخ والبوسفور", latin: "Topkapi Palace", category: "culture", label: "قصر ومتحف", note: "قصر عثماني تاريخي قريب من آيا صوفيا وحديقة غولهانه.", query: "Topkapi Palace Istanbul Turkey", position: { lat: 41.0115, lng: 28.9833 } },
  { name: "صهريج البازيليك", city: "إسطنبول", branch: "التاريخ والبوسفور", latin: "Basilica Cistern", category: "culture", label: "معلم تاريخي تحت الأرض", note: "صهريج تاريخي مميز في منطقة السلطان أحمد.", query: "Basilica Cistern Istanbul Turkey", position: { lat: 41.0084, lng: 28.9779 } },
  { name: "البازار الكبير", city: "إسطنبول", branch: "الأسواق والتسوق", latin: "Grand Bazaar", category: "cities", label: "سوق تاريخي", note: "سوق مسقوف واسع للهدايا والمنتجات التقليدية.", query: "Grand Bazaar Istanbul Turkey", position: { lat: 41.0107, lng: 28.9680 } },
  { name: "ميدان تقسيم", city: "إسطنبول", branch: "الأسواق والتسوق", latin: "Taksim Square", category: "cities", label: "ساحة وشارع حيوي", note: "ساحة مركزية وبداية شارع الاستقلال للمشي والتسوق.", query: "Taksim Square Istanbul Turkey", position: { lat: 41.0370, lng: 28.9850 } },
  { name: "مسجد أورتاكوي", city: "إسطنبول", branch: "البوسفور والإطلالات", latin: "Ortakoy Mosque", category: "culture", label: "مسجد على البوسفور", note: "واجهة تصوير شهيرة بجوار جسر البوسفور والمقاهي.", query: "Ortakoy Mosque Istanbul Turkey", position: { lat: 41.0470, lng: 29.0277 } },
  { name: "تل تشاملجا", city: "إسطنبول", branch: "البوسفور والإطلالات", latin: "Camlica Hill", category: "nature", label: "إطلالة بانورامية", note: "إطلالة مرتفعة على أجزاء واسعة من إسطنبول والبوسفور.", query: "Camlica Hill Istanbul Turkey", position: { lat: 41.0256, lng: 29.0686 } },
  { name: "تلة بيير لوتي", city: "إسطنبول", branch: "البوسفور والإطلالات", latin: "Pierre Loti Hill", category: "family", label: "مقهى وإطلالة", note: "إطلالة على القرن الذهبي مع إمكانية الوصول بالتلفريك.", query: "Pierre Loti Hill Istanbul Turkey", position: { lat: 41.0545, lng: 28.9330 } },
  { name: "ميني تورك", city: "إسطنبول", branch: "العائلة والترفيه", latin: "Miniaturk", category: "family", label: "حديقة مجسمات", note: "معالم تركيا المصغرة في مساحة مناسبة للنزهة العائلية.", query: "Miniaturk Istanbul Turkey", position: { lat: 41.0605, lng: 28.9497 } },
  { name: "آيا صوفيا", city: "إسطنبول", branch: "التاريخ والبوسفور", latin: "Hagia Sophia", category: "culture", label: "معلم تاريخي", note: "معلم عالمي في قلب المنطقة التاريخية.", query: "Hagia Sophia Istanbul Turkey", position: { lat: 41.0086, lng: 28.9802 } },
  { name: "جامع السلطان أحمد", city: "إسطنبول", branch: "التاريخ والبوسفور", latin: "Blue Mosque", category: "culture", label: "جامع تاريخي", note: "جامع تاريخي مميز في قلب السلطان أحمد.", query: "Blue Mosque Sultanahmet Istanbul Turkey", position: { lat: 41.0054, lng: 28.9768 } },
  { name: "برج غلطة", city: "إسطنبول", branch: "التاريخ والبوسفور", latin: "Galata Tower", category: "culture", label: "إطلالة بانورامية", note: "إطلالة بانورامية على القرن الذهبي والبوسفور.", query: "Galata Tower Istanbul Turkey", position: { lat: 41.0256, lng: 28.9741 } },
  { name: "قصر دولما بهجة", city: "إسطنبول", branch: "التاريخ والبوسفور", latin: "Dolmabahce Palace", category: "culture", label: "قصر على البوسفور", note: "قصر عثماني فخم على ضفة البوسفور.", query: "Dolmabahce Palace Istanbul Turkey", position: { lat: 41.0391, lng: 29.0007 } },
  { name: "البوسفور", city: "إسطنبول", branch: "التاريخ والبوسفور", latin: "Bosphorus", category: "cities", label: "رحلات وإطلالة", note: "مضيق إسطنبول ورحلات بحرية بين القارتين.", query: "Bosphorus Istanbul Turkey", position: { lat: 41.115, lng: 29.05 } },
  { name: "السوق المصري", city: "إسطنبول", branch: "الأسواق والتسوق", latin: "Spice Bazaar", category: "cities", label: "سوق التوابل", note: "سوق التوابل والهدايا قرب أمينونو.", query: "Spice Bazaar Istanbul Turkey", position: { lat: 41.0165, lng: 28.9709 } },
  { name: "جزر الأميرات", city: "إسطنبول", branch: "الجزر والحدائق", latin: "Princes Islands", category: "nature", label: "جزر وهدوء", note: "رحلة بحرية وأجواء هادئة بعيدًا عن ازدحام المدينة.", query: "Princes Islands Istanbul Turkey", position: { lat: 40.87, lng: 29.12 } },
  { name: "حديقة أميرغان", city: "إسطنبول", branch: "الجزر والحدائق", latin: "Emirgan Park", category: "nature", label: "حديقة وبوسفور", note: "حديقة واسعة وإطلالات جميلة على البوسفور.", query: "Emirgan Park Istanbul Turkey", position: { lat: 41.106, lng: 29.056 } },
  { name: "بولونيزكوي", city: "إسطنبول", branch: "القرى والطبيعة", latin: "Polonezkoy", category: "family", label: "قرية خضراء", note: "قرية خضراء ومطاعم ريفية مناسبة للعائلة.", query: "Polonezkoy Istanbul Turkey", position: { lat: 41.117, lng: 29.208 } },
  { name: "أكواريوم إسطنبول", city: "إسطنبول", branch: "العائلة والترفيه", latin: "Istanbul Aquarium", category: "family", label: "تجربة عائلية", note: "أكواريوم عائلي ومسار ترفيهي قرب فلوريا.", query: "Istanbul Aquarium Florya Turkey", position: { lat: 40.971, lng: 28.797 } },
  { name: "شلالات مارتفيلي", city: "جورجيا", branch: "الطبيعة والشلالات", latin: "Martvili Canyon", category: "nature", label: "وادي وشلالات", note: "مياه فيروزية وممرات طبيعية في جورجيا.", query: "Martvili Canyon Georgia", position: { lat: 42.457, lng: 42.377 } },
  { name: "بوليفارد باتومي", city: "جورجيا", branch: "المدينة والبحر", latin: "Batumi Boulevard", category: "family", label: "واجهة بحرية", note: "ممشى طويل وحدائق ومطاعم على البحر.", query: "Batumi Boulevard Georgia", position: { lat: 41.651, lng: 41.635 } },
  { name: "حديقة باتومي النباتية", city: "جورجيا", branch: "الطبيعة والشلالات", latin: "Batumi Botanical Garden", category: "nature", label: "حديقة وطبيعة", note: "حديقة ساحلية واسعة بإطلالات نباتية وبحرية.", query: "Batumi Botanical Garden Georgia", position: { lat: 41.69, lng: 41.705 } },
];

const filters: Array<{ key: MapCategory; label: string }> = [
  { key: "all", label: "كل الوجهات" },
  { key: "cities", label: "مدن" },
  { key: "nature", label: "طبيعة" },
  { key: "culture", label: "تاريخ" },
  { key: "family", label: "عائلية" },
];

const categoryColor: Record<MapDestination["category"], string> = {
  cities: "#d2ae62",
  nature: "#66a889",
  culture: "#b98b62",
  family: "#79a7b3",
};

export function InteractiveNorthMap() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MapCategory>("all");
  const [selectedCity, setSelectedCity] = useState<string | null>("طرابزون");
  const [selected, setSelected] = useState<MapDestination | null>(null);
  const [map, setMap] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const markersRef = useRef<Array<{ destination: MapDestination; marker: any }>>([]);

  const cityNames = ["طرابزون", "يومرا", "أرسين", "سورميني", "أراكلي", "ريزا", "أوردو", "سامسون", "جيرسون", "إسطنبول", "يالوا", "صبنجا", "كارتبه", "بورصة", "ساكاريا", "إزميت", "أولاشلي", "أنقرة", "جورجيا"];

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return selectedCity ? destinations.filter((item) => {
      const matchesCity = item.city === selectedCity;
      const matchesFilter = filter === "all" || item.category === filter;
      const matchesQuery = !normalized || `${item.name} ${item.latin} ${item.label}`.toLocaleLowerCase().includes(normalized);
      return matchesCity && matchesFilter && matchesQuery;
    }) : [];
  }, [filter, query, selectedCity]);

  const openDestination = (destination: MapDestination) => {
    // Keep the selected place visible in the list as well as on the map.
    setSelectedCity(destination.city);
    setFilter(destination.category);
    setQuery("");
    setSelected(destination);
    map?.panTo(destination.position);
    map?.setZoom(13);
    window.setTimeout(() => document.querySelector(".north-map-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  };

  // Keep map markers synchronized with the city, category, and text search.
  // This avoids showing pins that are hidden from the destination list.
  useEffect(() => {
    if (!map || !selectedCity) return;
    const normalized = query.trim().toLocaleLowerCase();
    const cityPlaces = destinations.filter((item) => item.city === selectedCity);
    markersRef.current.forEach(({ destination, marker }) => {
      const matchesCity = destination.city === selectedCity;
      const matchesCategory = filter === "all" || destination.category === filter;
      const matchesQuery = !normalized || `${destination.name} ${destination.latin} ${destination.label}`.toLocaleLowerCase().includes(normalized);
      const visible = matchesCity && matchesCategory && matchesQuery;
      if (typeof marker.setMap === "function") marker.setMap(visible ? map : null);
    });
  }, [map, selectedCity, filter, query]);

  // Move the camera only when the city changes, not when the visitor filters or searches.
  // That way selecting a specific destination keeps its close-up view.
  useEffect(() => {
    if (!map || !selectedCity) return;
    const cityPlaces = destinations.filter((item) => item.city === selectedCity);
    if (cityPlaces.length === 0) return;
    // Istanbul spans two continents; begin around the historic/central area.
    if (selectedCity === "إسطنبول") {
      map.panTo({ lat: 41.025, lng: 28.985 });
      map.setZoom(10.5);
      return;
    }
    if (cityPlaces.length === 1) {
      map.panTo(cityPlaces[0].position);
      map.setZoom(11);
      return;
    }
    map.fitBounds(cityPlaces.map((place) => place.position), 64);
    window.setTimeout(() => {
      const currentZoom = map.getZoom() ?? 10;
      if (currentZoom > 12) map.setZoom(12);
    }, 100);
  }, [map, selectedCity]);

  const directionsUrl = selected
    ? `https://www.google.com/maps/dir/?api=1&destination=${selected.position.lat}%2C${selected.position.lng}&destination_place_id=&travelmode=driving`
    : "https://www.google.com/maps/search/Northern+Turkey";
  const selectedCityPlaces = destinations.filter((item) => item.city === selectedCity);
  const fallbackCenter = selected?.position ?? (selectedCityPlaces.length
    ? {
        lat: selectedCityPlaces.reduce((sum, item) => sum + item.position.lat, 0) / selectedCityPlaces.length,
        lng: selectedCityPlaces.reduce((sum, item) => sum + item.position.lng, 0) / selectedCityPlaces.length,
      }
    : { lat: 41.0053, lng: 39.7225 });
  const broadRegion = ["إسطنبول", "يالوا", "صبنجا", "كارتبه", "بورصة", "ساكاريا", "إزميت", "أولاشلي", "أنقرة", "جورجيا"].includes(selectedCity ?? "");
  const fallbackZoom = selected ? 13 : broadRegion ? 9 : 10;

  const mapContent = (
    <div className={`north-map-experience ${expanded ? "north-map-expanded" : ""}`} dir="rtl">
      <div className="north-map-view-actions">
        {!expanded ? <button type="button" className="north-map-expand" onClick={() => setExpanded(true)}><ExternalLink size={16} /> فتح الخريطة بحجم كامل</button> : <button type="button" className="north-map-close" onClick={() => setExpanded(false)}><X size={17} /> إغلاق الخريطة</button>}
      </div>
      <div className="north-map-toolbar">
        <div className="north-map-search">
          <Search size={18} aria-hidden="true" />
          <input aria-label="ابحث في الخريطة" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن أوزنجول، شلال، مطعم…" />
          {query && <button type="button" aria-label="مسح البحث" onClick={() => setQuery("")}><X size={16} /></button>}
        </div>
        <div className="north-map-filters" aria-label="فلاتر الخريطة" role="group">
          <Filter size={15} aria-hidden="true" />
          {filters.map((item) => <button type="button" key={item.key} aria-pressed={filter === item.key} className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>{item.label}</button>)}
        </div>
      </div>

      <div className="north-map-city-picker" aria-label="اختر مدينة لعرض وجهاتها" role="tablist">
        <div className="north-map-city-picker-title"><strong>اختر المدينة</strong><span>تظهر أماكنها ومرتفعاتها هنا فوراً</span></div>
        <div className="north-map-city-buttons">
          {cityNames.map((city) => <button type="button" role="tab" aria-selected={selectedCity === city} className={selectedCity === city ? "active" : ""} key={city} onClick={() => { setSelectedCity(city); setFilter("all"); setSelected(null); }}>{city}</button>)}
        </div>
      </div>

      <div className="north-map-body">
        <aside className="north-map-destinations">
          <div className="north-map-aside-heading"><span>{selectedCity} · الوجهات</span><strong>{visible.length} وجهات أمامك</strong></div>
          <div className="north-map-destination-list">
            {selectedCity ? Array.from(new Set(visible.map((item) => item.branch))).map((branch) => <div className="north-map-branch" key={branch}><h4>{branch}</h4>{visible.filter((item) => item.branch === branch).map((destination, index) => <button type="button" key={destination.name} aria-label={`اختيار وجهة الخريطة رقم ${index + 1}`} className={`north-map-destination ${selected?.name === destination.name ? "selected" : ""}`} onClick={() => openDestination(destination)}>
              <span className="north-map-number" style={{ background: categoryColor[destination.category] }}>{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{destination.name}</strong><small>{destination.latin} · {destination.label}</small></span>
              <MapPin size={15} />
            </button>)}</div>) : <p className="north-map-empty">اختر مدينة من الأعلى لتظهر وجهاتها هنا.</p>}
            {!visible.length && selectedCity && <p className="north-map-empty">لم نجد هذه الوجهة. جرّب اسم مدينة أو طبيعة.</p>}
          </div>
        </aside>

        <div className="north-map-canvas-wrap">
          <MapView className="north-map-canvas" initialCenter={{ lat: 41.0053, lng: 39.7225 }} initialZoom={10} fallbackCenter={fallbackCenter} fallbackZoom={fallbackZoom} fallbackLabel={selected?.name ?? selectedCity ?? "الشمال التركي"} onMapReady={(readyMap) => {
            setMap(readyMap);
            markersRef.current = [];
            const L = window.L;
            if (!L || !readyMap?.leafletMap) return;
            destinations.forEach((destination) => {
              try {
                const icon = L.divIcon({
                  className: "north-map-leaflet-icon",
                  html: `<button class="north-map-marker" type="button" aria-label="فتح ${destination.name}"><span style="background:${categoryColor[destination.category]}"></span><b>${destination.name}</b></button>`,
                  iconSize: [100, 34],
                  iconAnchor: [50, 17],
                });
                const leafletMarker = L.marker([destination.position.lat, destination.position.lng], { icon });
                leafletMarker.on("click", () => openDestination(destination));
                const marker = {
                  setMap: (target: any) => {
                    if (target?.leafletMap) leafletMarker.addTo(target.leafletMap);
                    else if (leafletMarker._map) leafletMarker.remove();
                  },
                  addListener: (event: string, callback: () => void) => leafletMarker.on(event, callback),
                };
                markersRef.current.push({ destination, marker });
              } catch (error) {
                console.warn("Map marker unavailable; the destination list remains interactive.", error);
              }
            });
          }} />
        </div>
      </div>

      {selected && <div className="north-map-detail" role="region" aria-label={`تفاصيل ${selected.name}`}>
        <div className="north-map-detail-icon"><Sparkles size={20} /></div>
        <div className="north-map-detail-copy"><span>{selected.label} · {selected.latin}</span><strong>{selected.name}</strong><p>{selected.note}</p></div>
        <a className="north-map-directions" href={directionsUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> احصل على الاتجاهات <ExternalLink size={14} /></a>
      </div>}
    </div>
  );

  // A fixed map nested inside .site-shell is clipped by the shell overflow.
  // Render the expanded experience at document.body so mobile full-screen is truly full-screen.
  return expanded ? createPortal(mapContent, document.body) : mapContent;
}

export default InteractiveNorthMap;
