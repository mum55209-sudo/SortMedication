import { describe, expect, it } from "vitest";
import { DRUG_INFO, dailyMedUrl, findDrugInfo, normalizeDrugName } from "./drug-info";

// Product names from the 149-item sample medication list.
const SAMPLE_NAMES = `
Acetaminophen
Acetaminophen Children's
Adalimumab Pen
Albuterol HFA Inhaler
Albuterol Nebulizer Solution
Alendronate
Allopurinol
Alprazolam
Amlodipine
Amoxicillin
Amoxicillin-Clavulanate
Amphetamine-Dextroamphetamine
Apixaban
Aripiprazole
Artificial Tears
Aspirin Low Dose
Atorvastatin
Azithromycin
Benzonatate
Blood Glucose Test Strips
Budesonide-Formoterol Inhaler
Buprenorphine-Naloxone
Bupropion XL
COVID-19 Vaccine
Calcium Carbonate Antacid
Carvedilol
Cephalexin
Cetirizine
Ciprofloxacin
Citalopram
Clindamycin
Clonazepam
Clopidogrel
Clotrimazole
Cyclobenzaprine
Dextromethorphan-Guaifenesin
Diphenhydramine
Docusate Sodium
Doxycycline Hyclate
Dulaglutide Pen
Duloxetine
Empagliflozin
Enoxaparin
Epinephrine Auto-Injector
Escitalopram
Estradiol
Ezetimibe
Famotidine
Fentanyl Transdermal
Fexofenadine
Finasteride
Fluconazole
Fluoxetine
Fluticasone Nasal Spray
Fluticasone-Salmeterol Inhaler
Furosemide
Gabapentin
Glimepiride
Glipizide
Glucagon Emergency Kit
Hepatitis B Vaccine
Hydrochlorothiazide
Hydrocodone-Acetaminophen
Hydrocortisone
Hydroxyzine HCl
Ibuprofen
Ibuprofen Children's
Influenza Vaccine (Quadrivalent)
Insulin Aspart Vial
Insulin Glargine Pen
Insulin Lispro Pen
Insulin NPH Human Vial
Lamotrigine
Latanoprost Eye Drops
Levofloxacin
Levothyroxine
Lidocaine
Lisinopril
Loperamide
Loratadine
Lorazepam
Losartan
Medroxyprogesterone Injection
Meloxicam
Metformin
Metformin ER
Methylphenidate ER
Methylprednisolone Dose Pack
Metoprolol Succinate ER
Metoprolol Tartrate
Metronidazole
Montelukast
Morphine Sulfate ER
Mupirocin
Naloxone Nasal Spray
Naproxen Sodium
Nicotine Gum
Nicotine Patch
Nitrofurantoin Monohydrate
Nitroglycerin Sublingual
Norethindrone-Ethinyl Estradiol
Ofloxacin Eye Drops
Omeprazole
Ondansetron ODT
Oseltamivir
Oxycodone
Oxycodone-Acetaminophen
Pantoprazole
Pen Needles
Penicillin V Potassium
Pioglitazone
Pneumococcal Conjugate Vaccine
Polyethylene Glycol 3350
Pravastatin
Prednisone
Pregabalin
Prenatal Multivitamin
Promethazine with Codeine
Pseudoephedrine
Quetiapine
RSV Vaccine
Rosuvastatin
Semaglutide Pen
Sertraline
Shingles Vaccine (Recombinant)
Simvastatin
Sitagliptin
Spironolactone
Sulfamethoxazole-Trimethoprim
Tamsulosin
Tdap Vaccine
Testosterone Cypionate
Tiotropium Inhaler
Tramadol
Trazodone
Triamcinolone Acetonide
Valacyclovir
Valsartan
Varicella Vaccine
Venlafaxine ER
Vitamin D3
Warfarin
Zolpidem
`.trim().split("\n");

describe("drug info", () => {
  it("has an entry for every medication in the sample list", () => {
    const missing = SAMPLE_NAMES.filter((n) => !findDrugInfo(n));
    expect(missing).toEqual([]);
  });

  it("every entry says what it is for and a dose", () => {
    for (const d of DRUG_INFO) {
      expect(d.usedFor.length, d.name).toBeGreaterThan(3);
      expect(d.dose.length, d.name).toBeGreaterThan(3);
    }
  });

  it("names are unique", () => {
    const names = DRUG_INFO.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("prefers the more specific name", () => {
    expect(findDrugInfo("Metformin ER")?.name).toBe("metformin er");
    expect(findDrugInfo("Metformin")?.name).toBe("metformin");
    expect(findDrugInfo("Oxycodone-Acetaminophen")?.name).toBe("oxycodone-acetaminophen");
    expect(findDrugInfo("Oxycodone")?.name).toBe("oxycodone");
    expect(findDrugInfo("Acetaminophen Children's")?.name).toBe("acetaminophen children's");
  });

  it("ignores strength, case and brand names", () => {
    expect(findDrugInfo("insulin glargine")?.name).toBe("insulin glargine");
    expect(findDrugInfo("Insulin Glargine Pen 100 units/mL")?.name).toBe("insulin glargine");
    expect(findDrugInfo("LIPITOR 20 mg")?.name).toBe("atorvastatin");
    expect(normalizeDrugName("Amoxicillin 500 mg")).toBe("amoxicillin");
  });

  it("does not guess for unknown names or partial words", () => {
    expect(findDrugInfo("Unknownium")).toBeUndefined();
    expect(findDrugInfo("Metforminx")).toBeUndefined();
    expect(findDrugInfo("")).toBeUndefined();
  });

  it("links to DailyMed", () => {
    expect(dailyMedUrl("Amoxicillin 500 mg")).toContain("dailymed.nlm.nih.gov");
    expect(dailyMedUrl("Amoxicillin 500 mg")).toContain("query=amoxicillin");
  });
});
