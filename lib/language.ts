export type Language = "en" | "si" | "ta";

export function readLanguage(storage: Pick<Storage, "getItem">): Language {
  const value = storage.getItem("bhumisaara:language");
  return value === "si" || value === "ta" ? value : "en";
}

export function saveLanguage(storage: Pick<Storage, "setItem">, value: Language) {
  storage.setItem("bhumisaara:language", value);
}

const translations: Record<"si" | "ta", Record<string, string>> = {
  si: {
    "Dashboard": "උපකරණ පුවරුව", "Overview": "දළ විශ්ලේෂණය", "Fertilizer Subsidy": "පොහොර සහනාධාරය",
    "Green Market": "හරිත වෙළඳපොළ", "Farmer Requests": "ගොවි ඉල්ලීම්", "Imports & Stock": "ආනයන සහ තොග",
    "Distribution": "බෙදාහැරීම", "Subsidy Credits": "සහනාධාර ණය", "Storefront": "වෙළඳසැල",
    "Settlement": "පියවීම", "Administration": "පරිපාලනය", "New Application": "නව අයදුම්පත",
    "My Applications": "මගේ අයදුම්පත්", "Browse Market": "වෙළඳපොළ බලන්න", "My Orders": "මගේ ඇණවුම්",
    "My Credits": "මගේ ණය", "Review Queue": "සමාලෝචන පෝලිම", "Area Applications": "ප්‍රදේශ අයදුම්පත්",
    "Import History": "ආනයන ඉතිහාසය", "Sack Labels": "මලු ලේබල්", "Handover": "භාරදීම",
    "Handover History": "භාරදීම් ඉතිහාසය", "Incoming Orders": "ලැබෙන ඇණවුම්",
    "Issue Credits": "ණය නිකුත් කරන්න", "Redemption Claims": "මුදවාගැනීමේ හිමිකම්",
    "Dispute Investigations": "ආරවුල් විමර්ශන", "Notifications": "දැනුම්දීම්", "Profile": "පැතිකඩ",
    "Log out": "ඉවත් වන්න", "Welcome back": "නැවත සාදරයෙන් පිළිගනිමු", "Email": "විද්‍යුත් තැපෑල",
    "Password": "මුරපදය", "Sign in": "පිවිසෙන්න", "Sign up": "ලියාපදිංචි වන්න",
    "Fertilizer Subsidy Application": "පොහොර සහනාධාර අයදුම්පත", "Submit Application": "අයදුම්පත යොමු කරන්න",
    "Marketplace": "වෙළඳපොළ", "Confirm receipt": "ලැබීම තහවුරු කරන්න", "Mark ready": "සූදානම් ලෙස සලකුණු කරන්න",
    "Approve": "අනුමත කරන්න", "Reject": "ප්‍රතික්ෂේප කරන්න", "Fertilizer Request Approvals": "පොහොර ඉල්ලීම් අනුමැතිය",
    "Original transaction hash": "මුල් ගනුදෙනු හැෂය", "Retry recording": "නැවත ලියාපදිංචි කරන්න",
    "Season": "කන්නය", "Select season": "කන්නය තෝරන්න", "Fertilizer Type": "පොහොර වර්ගය",
    "Select type": "වර්ගය තෝරන්න", "Amount Required (KG)": "අවශ්‍ය ප්‍රමාණය (කි.ග්‍රෑ.)",
    "View application history": "අයදුම්පත් ඉතිහාසය බලන්න", "Place order": "ඇණවුම ඉදිරිපත් කරන්න",
    "Cancel": "අවලංගු කරන්න", "Dispute": "ආරවුලක් දක්වන්න", "Register": "ලියාපදිංචි වන්න",
    "Create Account": "ගිණුමක් සාදන්න", "Username": "පරිශීලක නාමය", "Role": "භූමිකාව",
  },
  ta: {
    "Dashboard": "முகப்புப் பலகை", "Overview": "மேலோட்டம்", "Fertilizer Subsidy": "உர மானியம்",
    "Green Market": "பசுமைச் சந்தை", "Farmer Requests": "விவசாயி கோரிக்கைகள்", "Imports & Stock": "இறக்குமதி மற்றும் இருப்பு",
    "Distribution": "விநியோகம்", "Subsidy Credits": "மானிய வரவுகள்", "Storefront": "விற்பனைக் கடை",
    "Settlement": "தீர்வு", "Administration": "நிர்வாகம்", "New Application": "புதிய விண்ணப்பம்",
    "My Applications": "என் விண்ணப்பங்கள்", "Browse Market": "சந்தையைப் பார்க்க", "My Orders": "என் ஆர்டர்கள்",
    "My Credits": "என் வரவுகள்", "Review Queue": "மதிப்பாய்வு வரிசை", "Area Applications": "பகுதி விண்ணப்பங்கள்",
    "Import History": "இறக்குமதி வரலாறு", "Sack Labels": "மூட்டை லேபிள்கள்", "Handover": "ஒப்படைப்பு",
    "Handover History": "ஒப்படைப்பு வரலாறு", "Incoming Orders": "வரும் ஆர்டர்கள்",
    "Issue Credits": "வரவுகளை வழங்கு", "Redemption Claims": "மீட்புக் கோரிக்கைகள்",
    "Dispute Investigations": "தகராறு விசாரணைகள்", "Notifications": "அறிவிப்புகள்", "Profile": "சுயவிவரம்",
    "Log out": "வெளியேறு", "Welcome back": "மீண்டும் வருக", "Email": "மின்னஞ்சல்",
    "Password": "கடவுச்சொல்", "Sign in": "உள்நுழை", "Sign up": "பதிவு செய்",
    "Fertilizer Subsidy Application": "உர மானிய விண்ணப்பம்", "Submit Application": "விண்ணப்பத்தைச் சமர்ப்பி",
    "Marketplace": "சந்தை", "Confirm receipt": "பெற்றதை உறுதிசெய்", "Mark ready": "தயாராக உள்ளது எனக் குறி",
    "Approve": "ஒப்புதல்", "Reject": "நிராகரி", "Fertilizer Request Approvals": "உரக் கோரிக்கை ஒப்புதல்கள்",
    "Original transaction hash": "அசல் பரிவர்த்தனை ஹாஷ்", "Retry recording": "மீண்டும் பதிவு செய்",
    "Season": "பருவம்", "Select season": "பருவத்தைத் தேர்வு செய்", "Fertilizer Type": "உர வகை",
    "Select type": "வகையைத் தேர்வு செய்", "Amount Required (KG)": "தேவையான அளவு (கி.கி.)",
    "View application history": "விண்ணப்ப வரலாற்றைப் பார்", "Place order": "ஆர்டர் செய்",
    "Cancel": "ரத்துசெய்", "Dispute": "தகராறு தெரிவி", "Register": "பதிவு செய்",
    "Create Account": "கணக்கை உருவாக்கு", "Username": "பயனர் பெயர்", "Role": "பங்கு",
  },
};

export function translate(language: Language, label: string): string {
  return language === "en" ? label : translations[language][label] ?? label;
}
