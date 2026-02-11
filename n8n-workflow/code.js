// 1. Avcı'dan gelen ham veriyi al
const rawData = $input.first().json.stdout;
let cities = [];

try {
    cities = JSON.parse(rawData);
} catch (e) {
    cities = [];
}

// 2. AYAR: Her seferde 1 şehir (Sunucu rahatlasın)
const chunkSize = 1; 
const returnItems = [];

// 3. Döngü
for (let i = 0; i < cities.length; i += chunkSize) {
    const chunk = cities.slice(i, i + chunkSize);
    
    // Veriyi metne dök
    const cityData = chunk.map(c => 
      `${c.city}: ${c.condition}, Sıcaklık ${c.tempDay}`
    ).join("");

    // --- YENİ PROMPT (DAHA BASİT VE NET) ---
    const prompt = `
GÖREV: Aşağıda verilen hava durumu verisine bakarak vatandaşa tek cümlelik samimi bir tavsiye ver.

DİKKAT: Sadece verilen hava durumuna sadık kal. Asla "Güneşli" gibi yazmayan bir şey uydurma.
Eğer yağmur varsa şemsiye uyarısı yap.
Eğer kar varsa sıkı giyinmesini söyle.

VERİ:
${cityData}

CEVAP FORMATI (Sadece bu JSON'u ver):
{
  "city": "${chunk[0].city}",
  "suggestion": "Tavsiyeni buraya yaz"
}
`;

    // 4. Paketi hazırla
    returnItems.push({
        json: {
            ollamaBody: {
                model: "gemma2:2b",
                prompt: prompt,
                stream: false,
                format: "json",
                options: { temperature: 0.1 } // 0.1 yaptık ki yaratıcılık yapıp saçmalamasın!
            }
        }
    });
}

return returnItems;