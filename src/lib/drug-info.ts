// Reference info for common medications: what each is usually used for and
// a typical adult dose. Written in plain words from the FDA-approved labels
// (as published on DailyMed) and CDC vaccine schedules.
//
// This is a quick reminder for staff, NOT medical advice and NOT a substitute
// for the full label or the prescriber's directions. The pharmacist must
// always check the actual prescription and label. Every entry links to
// DailyMed so it can be checked in one click.
//
// Doses here are for adults with normal kidney and liver function unless the
// entry says otherwise. Many medicines need lower doses for older people,
// children, or people with kidney or liver problems.

export type DrugInfo = {
  /** Base name, lowercase. A product matches if its name starts with this. */
  name: string;
  /** Other names it is sold under, lowercase (brand names, spellings). */
  aliases?: string[];
  /** What it is usually used for. */
  usedFor: string;
  /** Typical adult dose (or children's dose for children's products). */
  dose: string;
  /** One short safety point worth seeing at a glance, if any. */
  caution?: string;
  /** Not a medicine (test strips, needles); shown differently. */
  supply?: boolean;
};

const OPIOID = "Opioid: risk of addiction, overdose and slowed breathing. Check the state PDMP.";
const BENZO = "Benzodiazepine: risk of dependence; dangerous with opioids or alcohol.";
const FLUOROQUINOLONE = "Boxed warning: tendon rupture, nerve damage and mood effects.";
const ACETAMINOPHEN_MAX = "Contains acetaminophen: keep total from all products under 4,000 mg a day.";

export const DRUG_INFO: DrugInfo[] = [
  { name: "acetaminophen", aliases: ["tylenol", "paracetamol"], usedFor: "Mild to moderate pain and fever.", dose: "325–1,000 mg every 4–6 hours as needed. No more than 4,000 mg a day (3,000 mg is a common OTC label limit).", caution: "Liver damage in overdose or with heavy alcohol use." },
  { name: "acetaminophen children's", usedFor: "Pain and fever in children.", dose: "Children: 10–15 mg/kg every 4–6 hours as needed, no more than 5 doses in 24 hours. Use the dosing chart on the package and the syringe that comes with it." },
  { name: "adalimumab", aliases: ["humira"], usedFor: "Rheumatoid and psoriatic arthritis, ankylosing spondylitis, Crohn's disease, ulcerative colitis, plaque psoriasis and other immune conditions.", dose: "Rheumatoid arthritis: 40 mg injected under the skin every other week. Crohn's, colitis and psoriasis use a higher starting dose.", caution: "Boxed warning: serious infections (including TB) and cancer risk." },
  { name: "albuterol hfa inhaler", aliases: ["albuterol inhaler", "proair", "ventolin"], usedFor: "Quick relief of wheezing and shortness of breath in asthma and COPD; prevents exercise-induced asthma.", dose: "1–2 puffs (90 mcg each) every 4–6 hours as needed. For exercise: 2 puffs 15–30 minutes before." },
  { name: "albuterol nebulizer solution", usedFor: "Quick relief of wheezing in asthma and COPD.", dose: "2.5 mg by nebulizer 3–4 times a day as needed." },
  { name: "alendronate", aliases: ["fosamax"], usedFor: "Treating and preventing osteoporosis (thin bones).", dose: "70 mg once a week (or 10 mg daily). Take first thing in the morning with a full glass of water, and stay upright for 30 minutes." },
  { name: "allopurinol", aliases: ["zyloprim"], usedFor: "Gout and high uric acid; preventing kidney stones from uric acid.", dose: "Start 100 mg once daily and increase slowly. Usual 200–300 mg a day for mild gout; maximum 800 mg a day." },
  { name: "alprazolam", aliases: ["xanax"], usedFor: "Anxiety and panic disorder.", dose: "Anxiety: 0.25–0.5 mg three times a day; maximum 4 mg a day. Panic disorder may need more.", caution: BENZO },
  { name: "amlodipine", aliases: ["norvasc"], usedFor: "High blood pressure and chest pain (angina).", dose: "5 mg once daily; maximum 10 mg. Older or frail people may start at 2.5 mg." },
  { name: "amoxicillin", aliases: ["amoxil"], usedFor: "Bacterial infections of the ear, nose, throat, chest, urinary tract and skin; part of H. pylori treatment.", dose: "250–500 mg every 8 hours, or 500–875 mg every 12 hours, depending on the infection.", caution: "Penicillin: check for allergy." },
  { name: "amoxicillin-clavulanate", aliases: ["augmentin", "amoxicillin clavulanate"], usedFor: "Bacterial infections (sinus, ear, chest, skin, urinary) that may resist amoxicillin alone.", dose: "500/125 mg every 8 hours, or 875/125 mg every 12 hours. Take with food.", caution: "Penicillin: check for allergy." },
  { name: "amphetamine-dextroamphetamine", aliases: ["adderall", "amphetamine dextroamphetamine"], usedFor: "ADHD and narcolepsy.", dose: "ADHD (immediate release): start 5 mg once or twice daily, raised weekly; usually no more than 40 mg a day. Extended release (adults): 20 mg each morning.", caution: "Schedule II stimulant: risk of misuse." },
  { name: "apixaban", aliases: ["eliquis"], usedFor: "Preventing stroke in atrial fibrillation; treating and preventing blood clots (DVT, PE).", dose: "Atrial fibrillation: 5 mg twice daily (2.5 mg twice daily for some older or smaller patients). Clot treatment: 10 mg twice daily for 7 days, then 5 mg twice daily.", caution: "Blood thinner: bleeding risk. Do not stop suddenly." },
  { name: "aripiprazole", aliases: ["abilify"], usedFor: "Schizophrenia, bipolar disorder, add-on treatment for depression, irritability with autism, Tourette's.", dose: "Schizophrenia: 10–15 mg once daily (maximum 30 mg). Add-on for depression: 2–5 mg daily (maximum 15 mg).", caution: "Boxed warning: higher death risk in elderly dementia patients; suicidal thoughts in young people." },
  { name: "artificial tears", usedFor: "Dry, irritated eyes.", dose: "1–2 drops in the affected eye(s) as needed." },
  { name: "aspirin low dose", aliases: ["aspirin 81", "baby aspirin"], usedFor: "Preventing heart attack and stroke in people at risk, when advised by a prescriber.", dose: "81 mg once daily.", caution: "Bleeding risk, especially with other blood thinners or NSAIDs." },
  { name: "atorvastatin", aliases: ["lipitor"], usedFor: "Lowering LDL cholesterol and reducing heart attack and stroke risk.", dose: "10–20 mg once daily to start (40 mg for larger reduction); range 10–80 mg." },
  { name: "azithromycin", aliases: ["zithromax", "z-pak"], usedFor: "Bacterial infections of the chest, sinuses, throat and skin, and some sexually transmitted infections.", dose: "5-day pack: 500 mg on day 1, then 250 mg daily on days 2–5. Chlamydia: 1 g once." },
  { name: "benzonatate", aliases: ["tessalon"], usedFor: "Relief of cough.", dose: "100–200 mg three times a day as needed; maximum 600 mg a day. Swallow whole; do not chew.", caution: "Keep away from children: accidental swallowing can be fatal." },
  { name: "blood glucose test strips", aliases: ["test strips", "glucose strips"], supply: true, usedFor: "Checking blood sugar with a matching meter, for people with diabetes.", dose: "Not a medicine. How often to test depends on the patient's treatment plan." },
  { name: "budesonide-formoterol inhaler", aliases: ["symbicort", "budesonide formoterol"], usedFor: "Long-term control of asthma and COPD.", dose: "2 puffs twice daily (80/4.5 or 160/4.5 mcg). Rinse mouth after use." },
  { name: "buprenorphine-naloxone", aliases: ["suboxone", "zubsolv", "buprenorphine naloxone"], usedFor: "Treating opioid use disorder.", dose: "After starting: usually 16/4 mg once daily under the tongue (range 4/1–24/6 mg).", caution: "Schedule III. Dangerous with benzodiazepines or alcohol." },
  { name: "bupropion xl", aliases: ["wellbutrin xl"], usedFor: "Depression and seasonal affective disorder. (Bupropion SR is also used to help stop smoking.)", dose: "XL: 150 mg each morning, usually raised to 300 mg once daily; maximum 450 mg.", caution: "Seizure risk at high doses or with eating disorders. Boxed warning: suicidal thoughts in young people." },
  { name: "covid-19 vaccine", aliases: ["covid vaccine", "covid 19 vaccine"], usedFor: "Preventing COVID-19.", dose: "One intramuscular dose of the current season's vaccine, following current CDC recommendations. Dose volume depends on the product and age." },
  { name: "calcium carbonate antacid", aliases: ["tums", "calcium carbonate"], usedFor: "Heartburn, acid indigestion and upset stomach.", dose: "Chew 2–4 tablets when symptoms occur. Do not go over the daily maximum on the package for that strength." },
  { name: "carvedilol", aliases: ["coreg"], usedFor: "Heart failure, high blood pressure, and after a heart attack.", dose: "Heart failure: 3.125 mg twice daily, doubled every 2 weeks as tolerated to 25 mg twice daily (50 mg twice daily if over 85 kg). Take with food.", caution: "Do not stop suddenly." },
  { name: "cephalexin", aliases: ["keflex"], usedFor: "Bacterial infections of the skin, bone, urinary tract, chest and ears.", dose: "250–500 mg every 6 hours, or 500 mg every 12 hours for some infections. Maximum 4 g a day." },
  { name: "cetirizine", aliases: ["zyrtec"], usedFor: "Allergies (hay fever) and hives.", dose: "5–10 mg once daily." },
  { name: "ciprofloxacin", aliases: ["cipro"], usedFor: "Bacterial infections such as urinary tract, bone, joint and some stomach infections.", dose: "250–750 mg every 12 hours, depending on the infection.", caution: FLUOROQUINOLONE },
  { name: "citalopram", aliases: ["celexa"], usedFor: "Depression.", dose: "20 mg once daily; maximum 40 mg (20 mg if over 60 years old).", caution: "Heart rhythm (QT) risk at high doses. Boxed warning: suicidal thoughts in young people." },
  { name: "clindamycin", aliases: ["cleocin"], usedFor: "Serious bacterial infections, including skin, bone, chest and dental infections, in people who can't take penicillin.", dose: "150–450 mg every 6 hours.", caution: "Boxed warning: severe diarrhea (C. difficile)." },
  { name: "clonazepam", aliases: ["klonopin"], usedFor: "Seizure disorders and panic disorder.", dose: "Panic disorder: 0.25 mg twice daily, raised to 1 mg a day; maximum 4 mg a day. Seizures: start 1.5 mg a day in 3 doses.", caution: BENZO },
  { name: "clopidogrel", aliases: ["plavix"], usedFor: "Preventing heart attack and stroke after a heart attack, stent, recent stroke or with artery disease.", dose: "75 mg once daily (a 300 mg loading dose is used in some heart conditions).", caution: "Bleeding risk." },
  { name: "clotrimazole", aliases: ["lotrimin"], usedFor: "Fungal skin infections (athlete's foot, jock itch, ringworm) and vaginal yeast infections.", dose: "Cream: apply a thin layer twice daily for 2–4 weeks. Vaginal products: follow the package." },
  { name: "cyclobenzaprine", aliases: ["flexeril"], usedFor: "Short-term relief of muscle spasm.", dose: "5 mg three times a day, up to 10 mg three times a day, for no more than 2–3 weeks.", caution: "Causes drowsiness." },
  { name: "dextromethorphan-guaifenesin", aliases: ["mucinex dm", "robitussin dm", "dextromethorphan guaifenesin"], usedFor: "Cough and chest congestion from colds.", dose: "Depends on the product. Extended-release 600/30 mg tablets: 1–2 tablets every 12 hours, no more than 4 in 24 hours." },
  { name: "diphenhydramine", aliases: ["benadryl"], usedFor: "Allergies, hay fever, hives, itching; occasional sleeplessness.", dose: "Allergy: 25–50 mg every 4–6 hours; maximum 300 mg a day. Sleep: 50 mg at bedtime.", caution: "Drowsiness; avoid in older adults where possible." },
  { name: "docusate sodium", aliases: ["colace", "docusate"], usedFor: "Occasional constipation (stool softener).", dose: "50–300 mg a day, in one dose or split (often 100 mg 1–3 times daily)." },
  { name: "doxycycline hyclate", aliases: ["doxycycline", "vibramycin"], usedFor: "Bacterial infections (chest, skin, acne, Lyme disease, some STIs) and malaria prevention.", dose: "100 mg every 12 hours on day 1, then 100 mg once or twice daily. Take with a full glass of water and stay upright.", caution: "Sun sensitivity. Avoid in pregnancy and young children." },
  { name: "dulaglutide", aliases: ["trulicity"], usedFor: "Type 2 diabetes; lowers heart attack and stroke risk in some patients.", dose: "0.75 mg injected under the skin once weekly; may be raised to 1.5 mg, then up to 4.5 mg weekly, at least 4 weeks per step.", caution: "Boxed warning: thyroid C-cell tumors." },
  { name: "duloxetine", aliases: ["cymbalta"], usedFor: "Depression, generalized anxiety, diabetic nerve pain, fibromyalgia and long-lasting muscle and joint pain.", dose: "30–60 mg once daily; maximum 120 mg a day.", caution: "Boxed warning: suicidal thoughts in young people." },
  { name: "empagliflozin", aliases: ["jardiance"], usedFor: "Type 2 diabetes, heart failure and chronic kidney disease.", dose: "10 mg once daily in the morning; may be raised to 25 mg for blood sugar control." },
  { name: "enoxaparin", aliases: ["lovenox"], usedFor: "Preventing and treating blood clots (DVT, PE); some heart attack treatment.", dose: "Prevention: 40 mg under the skin once daily. Treatment: 1 mg/kg every 12 hours. Lower doses with kidney problems.", caution: "Boxed warning: spinal bleeding with epidurals or spinal taps." },
  { name: "epinephrine auto-injector", aliases: ["epipen"], usedFor: "Emergency treatment of severe allergic reactions (anaphylaxis).", dose: "Adults and children over 30 kg: 0.3 mg into the outer thigh. 15–30 kg: 0.15 mg. A second dose may be given if needed. Call 911." },
  { name: "escitalopram", aliases: ["lexapro"], usedFor: "Depression and generalized anxiety.", dose: "10 mg once daily; maximum 20 mg.", caution: "Boxed warning: suicidal thoughts in young people." },
  { name: "estradiol", aliases: ["estrace"], usedFor: "Menopause symptoms (hot flashes, vaginal dryness), preventing osteoporosis, low estrogen.", dose: "Tablets: 1–2 mg once daily. Use the lowest dose that works for the shortest time.", caution: "Boxed warnings: blood clots, stroke, breast and uterine cancer." },
  { name: "ezetimibe", aliases: ["zetia"], usedFor: "Lowering cholesterol, alone or with a statin.", dose: "10 mg once daily." },
  { name: "famotidine", aliases: ["pepcid"], usedFor: "Heartburn, acid reflux (GERD) and stomach ulcers.", dose: "OTC: 10–20 mg up to twice daily. Prescription: 20 mg twice daily for GERD; 40 mg at bedtime for ulcers. Lower doses with kidney problems." },
  { name: "fentanyl transdermal", aliases: ["fentanyl patch", "duragesic"], usedFor: "Severe, long-lasting pain in patients already used to opioids.", dose: "One patch every 72 hours. Strength (12–100 mcg/hour) is worked out from the patient's current opioid dose. Never for patients new to opioids.", caution: OPIOID },
  { name: "fexofenadine", aliases: ["allegra"], usedFor: "Seasonal allergies and hives.", dose: "180 mg once daily, or 60 mg twice daily. Take with water, not fruit juice." },
  { name: "finasteride", aliases: ["proscar", "propecia"], usedFor: "Enlarged prostate (5 mg) and male-pattern hair loss (1 mg).", dose: "Enlarged prostate: 5 mg once daily. Hair loss: 1 mg once daily.", caution: "Pregnant women should not handle broken tablets." },
  { name: "fluconazole", aliases: ["diflucan"], usedFor: "Yeast and other fungal infections.", dose: "Vaginal yeast infection: one 150 mg dose. Other infections: often 200 mg on day 1, then 100 mg daily." },
  { name: "fluoxetine", aliases: ["prozac"], usedFor: "Depression, OCD, bulimia and panic disorder.", dose: "20 mg each morning; range 20–80 mg a day.", caution: "Boxed warning: suicidal thoughts in young people." },
  { name: "fluticasone nasal spray", aliases: ["flonase", "fluticasone propionate nasal"], usedFor: "Nasal allergy symptoms (sneezing, runny or stuffy nose).", dose: "2 sprays in each nostril once daily, then 1 spray each nostril daily once symptoms are controlled." },
  { name: "fluticasone-salmeterol inhaler", aliases: ["advair", "wixela", "fluticasone salmeterol"], usedFor: "Long-term control of asthma and COPD (not for sudden attacks).", dose: "1 inhalation twice daily (Diskus: 100/50 to 500/50 mcg for asthma; 250/50 mcg for COPD). Rinse mouth after use." },
  { name: "furosemide", aliases: ["lasix"], usedFor: "Swelling (fluid build-up) from heart, liver or kidney disease; high blood pressure.", dose: "Swelling: 20–80 mg once, repeated or raised as needed. Blood pressure: 40 mg twice daily.", caution: "Can cause dehydration and low potassium." },
  { name: "gabapentin", aliases: ["neurontin"], usedFor: "Nerve pain after shingles; add-on treatment for seizures.", dose: "Start 300 mg on day 1, 300 mg twice on day 2, 300 mg three times on day 3. Usual 900–1,800 mg a day in 3 doses; maximum 3,600 mg. Lower doses with kidney problems.", caution: "Drowsiness; breathing risk with opioids." },
  { name: "glimepiride", aliases: ["amaryl"], usedFor: "Type 2 diabetes.", dose: "1–2 mg once daily with breakfast; maximum 8 mg.", caution: "Can cause low blood sugar." },
  { name: "glipizide", aliases: ["glucotrol"], usedFor: "Type 2 diabetes.", dose: "5 mg before breakfast (2.5 mg for older people). Maximum 40 mg a day (immediate release) or 20 mg (extended release).", caution: "Can cause low blood sugar." },
  { name: "glucagon emergency kit", aliases: ["glucagon"], usedFor: "Emergency treatment of severe low blood sugar.", dose: "Adults and children 25 kg or more: 1 mg injection. Smaller children: 0.5 mg. Call 911." },
  { name: "hepatitis b vaccine", aliases: ["engerix-b", "recombivax", "heplisav"], usedFor: "Preventing hepatitis B.", dose: "Intramuscular series: 2 doses one month apart (Heplisav-B) or 3 doses at 0, 1 and 6 months (Engerix-B, Recombivax HB)." },
  { name: "hydrochlorothiazide", aliases: ["hctz"], usedFor: "High blood pressure and swelling.", dose: "12.5–25 mg once daily; maximum 50 mg." },
  { name: "hydrocodone-acetaminophen", aliases: ["norco", "vicodin", "hydrocodone acetaminophen"], usedFor: "Pain severe enough to need an opioid.", dose: "5/325 mg: 1–2 tablets every 4–6 hours as needed.", caution: `${OPIOID} ${ACETAMINOPHEN_MAX}` },
  { name: "hydrocortisone", aliases: ["cortisone cream"], usedFor: "Skin itching, rashes, eczema and insect bites (cream or ointment).", dose: "1% cream: thin layer on the area 1–4 times a day. (Tablets are used for other conditions at different doses.)" },
  { name: "hydroxyzine hcl", aliases: ["hydroxyzine", "atarax"], usedFor: "Anxiety, itching from allergies, and calming before procedures.", dose: "Anxiety: 50–100 mg up to 4 times a day. Itching: 25 mg 3–4 times a day.", caution: "Drowsiness." },
  { name: "ibuprofen", aliases: ["advil", "motrin"], usedFor: "Pain, fever, inflammation and arthritis.", dose: "OTC: 200–400 mg every 4–6 hours, maximum 1,200 mg a day. Prescription: 400–800 mg 3–4 times a day, maximum 3,200 mg. Take with food.", caution: "Stomach bleeding, kidney and heart risks." },
  { name: "ibuprofen children's", usedFor: "Fever and pain in children 6 months and older.", dose: "Children: 5–10 mg/kg every 6–8 hours, no more than 4 doses a day. Use the chart on the package." },
  { name: "influenza vaccine", aliases: ["flu vaccine", "flu shot"], usedFor: "Preventing the flu.", dose: "0.5 mL intramuscular once each flu season. Some children under 9 need 2 doses the first season." },
  { name: "insulin aspart", aliases: ["novolog", "fiasp"], usedFor: "Mealtime (rapid-acting) insulin for type 1 and type 2 diabetes.", dose: "Dose is set for each patient. Inject 5–10 minutes before meals.", caution: "Low blood sugar risk. Check units and pen type carefully." },
  { name: "insulin glargine", aliases: ["lantus", "basaglar", "semglee", "toujeo"], usedFor: "Long-acting (background) insulin for type 1 and type 2 diabetes.", dose: "Type 2 start: 0.2 units/kg or up to 10 units once daily at the same time each day. Type 1: about a third of total daily insulin.", caution: "Low blood sugar risk. Toujeo is 300 units/mL; others are 100 units/mL." },
  { name: "insulin lispro", aliases: ["humalog", "admelog", "lyumjev"], usedFor: "Mealtime (rapid-acting) insulin for type 1 and type 2 diabetes.", dose: "Dose is set for each patient. Inject within 15 minutes before or right after a meal.", caution: "Low blood sugar risk. Check strength (100 or 200 units/mL)." },
  { name: "insulin nph human", aliases: ["insulin nph", "humulin n", "novolin n"], usedFor: "Intermediate-acting insulin for type 1 and type 2 diabetes.", dose: "Dose is set for each patient; usually injected once or twice daily. Roll gently to mix before use.", caution: "Low blood sugar risk." },
  { name: "lamotrigine", aliases: ["lamictal"], usedFor: "Epilepsy and long-term treatment of bipolar disorder.", dose: "Bipolar (no interacting drugs): 25 mg daily for 2 weeks, 50 mg for 2 weeks, 100 mg for 1 week, then 200 mg daily. Different schedule with valproate or carbamazepine.", caution: "Boxed warning: serious rash. Must be started slowly." },
  { name: "latanoprost eye drops", aliases: ["latanoprost", "xalatan"], usedFor: "Glaucoma and high pressure in the eye.", dose: "1 drop in the affected eye(s) once daily in the evening. Store unopened bottles in the fridge." },
  { name: "levofloxacin", aliases: ["levaquin"], usedFor: "Bacterial infections such as pneumonia, sinus, urinary and skin infections.", dose: "250–750 mg once daily for 3–14 days, depending on the infection.", caution: FLUOROQUINOLONE },
  { name: "levothyroxine", aliases: ["synthroid", "levoxyl", "euthyrox"], usedFor: "Underactive thyroid (hypothyroidism).", dose: "Full dose is about 1.6 mcg/kg a day; older people or those with heart disease start at 12.5–25 mcg. Take on an empty stomach 30–60 minutes before breakfast." },
  { name: "lidocaine", aliases: ["lidoderm"], usedFor: "Numbing the skin; nerve pain after shingles (5% patch); minor aches (OTC patches and creams).", dose: "5% patch: up to 3 patches at once, on for up to 12 hours then off for 12 hours. Creams and OTC patches: follow the package." },
  { name: "lisinopril", aliases: ["zestril", "prinivil"], usedFor: "High blood pressure, heart failure, and after a heart attack.", dose: "Blood pressure: 10 mg once daily; usual 20–40 mg; maximum 80 mg. Heart failure: start 2.5–5 mg daily.", caution: "Can cause cough and high potassium. Do not use in pregnancy." },
  { name: "loperamide", aliases: ["imodium"], usedFor: "Diarrhea.", dose: "4 mg after the first loose stool, then 2 mg after each loose stool. OTC maximum 8 mg a day.", caution: "High doses can cause serious heart rhythm problems." },
  { name: "loratadine", aliases: ["claritin"], usedFor: "Allergies (hay fever) and hives.", dose: "10 mg once daily." },
  { name: "lorazepam", aliases: ["ativan"], usedFor: "Anxiety; short-term trouble sleeping caused by anxiety.", dose: "Anxiety: 2–3 mg a day split into 2–3 doses (range 1–10 mg a day). Sleep: 2–4 mg at bedtime.", caution: BENZO },
  { name: "losartan", aliases: ["cozaar"], usedFor: "High blood pressure, kidney protection in type 2 diabetes, and stroke risk reduction.", dose: "50 mg once daily; range 25–100 mg.", caution: "Do not use in pregnancy." },
  { name: "medroxyprogesterone injection", aliases: ["depo-provera"], usedFor: "Birth control.", dose: "150 mg intramuscular every 3 months (13 weeks), or 104 mg under the skin every 12–14 weeks.", caution: "Boxed warning: bone thinning with long-term use." },
  { name: "meloxicam", aliases: ["mobic"], usedFor: "Osteoarthritis and rheumatoid arthritis.", dose: "7.5 mg once daily; maximum 15 mg.", caution: "Stomach bleeding, kidney and heart risks." },
  { name: "metformin", aliases: ["glucophage"], usedFor: "Type 2 diabetes.", dose: "500 mg twice daily or 850 mg once daily with meals, raised slowly; maximum 2,550 mg a day.", caution: "Check kidney function. Rare lactic acidosis." },
  { name: "metformin er", aliases: ["glucophage xr", "metformin extended release"], usedFor: "Type 2 diabetes.", dose: "500 mg once daily with the evening meal, raised by 500 mg each week; maximum 2,000 mg once daily.", caution: "Check kidney function. Rare lactic acidosis." },
  { name: "methylphenidate er", aliases: ["concerta"], usedFor: "ADHD.", dose: "Concerta (adults): 18 or 36 mg each morning; maximum 72 mg. Other long-acting brands are dosed differently.", caution: "Schedule II stimulant: risk of misuse." },
  { name: "methylprednisolone dose pack", aliases: ["medrol dosepak", "medrol"], usedFor: "Short course for inflammation: allergic reactions, asthma flares, rashes, joint swelling.", dose: "21 tablets of 4 mg over 6 days: 24 mg on day 1, then 4 mg less each day, following the pack." },
  { name: "metoprolol succinate er", aliases: ["toprol xl", "metoprolol succinate"], usedFor: "High blood pressure, chest pain (angina) and heart failure.", dose: "Blood pressure: 25–100 mg once daily. Heart failure: 12.5–25 mg once daily, doubled every 2 weeks up to 200 mg.", caution: "Do not stop suddenly." },
  { name: "metoprolol tartrate", aliases: ["lopressor"], usedFor: "High blood pressure, chest pain (angina) and after a heart attack.", dose: "Blood pressure: 100 mg a day in 1–2 doses (often 50 mg twice daily); range 100–450 mg a day.", caution: "Do not stop suddenly." },
  { name: "metronidazole", aliases: ["flagyl"], usedFor: "Bacterial and parasite infections, such as bacterial vaginosis, trichomoniasis and some stomach infections.", dose: "Bacterial vaginosis: 500 mg twice daily for 7 days. Trichomoniasis: 500 mg twice daily for 7 days (or 2 g once).", caution: "No alcohol during treatment and for 3 days after." },
  { name: "montelukast", aliases: ["singulair"], usedFor: "Preventing asthma, allergies and exercise-induced asthma.", dose: "10 mg once daily in the evening.", caution: "Boxed warning: mood and behavior changes, including suicidal thoughts." },
  { name: "morphine sulfate er", aliases: ["ms contin", "morphine er"], usedFor: "Severe, long-lasting pain needing an around-the-clock opioid.", dose: "Set for each patient. MS Contin as a first opioid: 15 mg every 8–12 hours. Patients already on opioids are converted from their current dose.", caution: OPIOID },
  { name: "mupirocin", aliases: ["bactroban"], usedFor: "Skin infections such as impetigo; nasal ointment to clear MRSA.", dose: "Apply a small amount to the area 3 times a day for up to 10 days." },
  { name: "naloxone nasal spray", aliases: ["narcan"], usedFor: "Emergency treatment of opioid overdose.", dose: "1 spray (4 mg) in one nostril. Call 911. If no response, give another spray in the other nostril every 2–3 minutes." },
  { name: "naproxen sodium", aliases: ["aleve", "naproxen", "anaprox"], usedFor: "Pain, fever, arthritis and period cramps.", dose: "OTC: 220 mg every 8–12 hours (440 mg for the first dose if needed), maximum 660 mg a day. Prescription naproxen: 250–500 mg twice daily.", caution: "Stomach bleeding, kidney and heart risks." },
  { name: "nicotine gum", aliases: ["nicorette"], usedFor: "Helping people stop smoking.", dose: "2 mg if the first cigarette is more than 30 minutes after waking, 4 mg if sooner. 1 piece every 1–2 hours for weeks 1–6, then fewer; maximum 24 pieces a day. 12-week course." },
  { name: "nicotine patch", aliases: ["nicoderm"], usedFor: "Helping people stop smoking.", dose: "More than 10 cigarettes a day: 21 mg patch daily for 6 weeks, then 14 mg for 2 weeks, then 7 mg for 2 weeks. 10 or fewer: start at 14 mg." },
  { name: "nitrofurantoin monohydrate", aliases: ["macrobid"], usedFor: "Bladder infections (UTIs).", dose: "Macrobid: 100 mg twice daily with food for 5–7 days.", caution: "Avoid when kidney function is poor." },
  { name: "nitroglycerin sublingual", aliases: ["nitrostat"], usedFor: "Chest pain (angina): relief during an attack or before activity.", dose: "0.4 mg under the tongue at the start of chest pain; may repeat every 5 minutes, up to 3 doses. Call 911 if pain is not better 5 minutes after the first dose.", caution: "Never use with sildenafil, tadalafil or similar drugs." },
  { name: "norethindrone-ethinyl estradiol", aliases: ["norethindrone ethinyl estradiol", "birth control pill"], usedFor: "Birth control.", dose: "One tablet daily at the same time each day, in the order on the pack.", caution: "Boxed warning: smoking raises heart and stroke risk, especially over age 35." },
  { name: "ofloxacin eye drops", aliases: ["ocuflox"], usedFor: "Bacterial eye infections (conjunctivitis) and corneal ulcers.", dose: "Conjunctivitis: 1–2 drops every 2–4 hours while awake on days 1–2, then 4 times a day on days 3–7." },
  { name: "omeprazole", aliases: ["prilosec"], usedFor: "Heartburn, acid reflux (GERD), stomach ulcers, and part of H. pylori treatment.", dose: "20 mg once daily before breakfast (40 mg for some conditions). OTC: 20 mg daily for 14 days." },
  { name: "ondansetron odt", aliases: ["zofran", "ondansetron"], usedFor: "Preventing nausea and vomiting from chemotherapy, radiation and surgery.", dose: "Chemotherapy: 8 mg 30 minutes before, again 8 hours later, then 8 mg twice daily for 1–2 days. Let the tablet melt on the tongue.", caution: "Heart rhythm (QT) risk." },
  { name: "oseltamivir", aliases: ["tamiflu"], usedFor: "Treating and preventing the flu.", dose: "Treatment: 75 mg twice daily for 5 days, started within 48 hours of symptoms. Prevention: 75 mg once daily for at least 10 days. Lower doses with kidney problems." },
  { name: "oxycodone", aliases: ["roxicodone", "oxycontin"], usedFor: "Pain severe enough to need an opioid.", dose: "Immediate release, patients new to opioids: 5–15 mg every 4–6 hours as needed. Extended release (OxyContin) is only for patients already used to opioids.", caution: OPIOID },
  { name: "oxycodone-acetaminophen", aliases: ["percocet", "oxycodone acetaminophen"], usedFor: "Pain severe enough to need an opioid.", dose: "5/325 mg: 1–2 tablets every 6 hours as needed.", caution: `${OPIOID} ${ACETAMINOPHEN_MAX}` },
  { name: "pantoprazole", aliases: ["protonix"], usedFor: "Acid reflux (GERD), healing a damaged esophagus, and conditions with too much stomach acid.", dose: "40 mg once daily for up to 8 weeks; may continue for maintenance." },
  { name: "pen needles", aliases: ["insulin pen needles"], supply: true, usedFor: "Needles for insulin and other injection pens.", dose: "Not a medicine. Use a new needle for each injection." },
  { name: "penicillin v potassium", aliases: ["penicillin vk", "penicillin v"], usedFor: "Strep throat and other mild to moderate infections; preventing rheumatic fever.", dose: "250–500 mg every 6–8 hours. Strep throat is usually treated for 10 days.", caution: "Penicillin: check for allergy." },
  { name: "pioglitazone", aliases: ["actos"], usedFor: "Type 2 diabetes.", dose: "15–30 mg once daily; maximum 45 mg.", caution: "Boxed warning: can cause or worsen heart failure." },
  { name: "pneumococcal conjugate vaccine", aliases: ["prevnar", "capvaxive", "vaxneuvance", "pneumococcal vaccine"], usedFor: "Preventing pneumonia and serious infections from pneumococcus bacteria.", dose: "Adults: one 0.5 mL intramuscular dose (PCV20 or PCV21; PCV15 is followed by PPSV23), per the CDC schedule." },
  { name: "polyethylene glycol 3350", aliases: ["miralax", "polyethylene glycol"], usedFor: "Occasional constipation.", dose: "17 g (one capful) stirred into 4–8 oz of drink once daily, for up to 7 days unless a prescriber says longer." },
  { name: "pravastatin", aliases: ["pravachol"], usedFor: "Lowering cholesterol and preventing heart disease.", dose: "40 mg once daily; range 10–80 mg." },
  { name: "prednisone", aliases: ["deltasone"], usedFor: "Inflammation and immune conditions such as asthma flares, arthritis, allergic reactions and skin conditions.", dose: "5–60 mg a day depending on the condition, often as a short course. Long courses must be tapered, not stopped suddenly.", caution: "Raises blood sugar; long use weakens bones and immunity." },
  { name: "pregabalin", aliases: ["lyrica"], usedFor: "Nerve pain (diabetes, shingles, spinal cord injury), fibromyalgia, and add-on treatment for seizures.", dose: "Diabetic nerve pain: 50 mg three times daily, up to 100 mg three times daily. Fibromyalgia: 75 mg twice daily, up to 225 mg twice daily. Lower doses with kidney problems.", caution: "Schedule V. Drowsiness; breathing risk with opioids." },
  { name: "prenatal multivitamin", aliases: ["prenatal vitamin", "prenatal"], usedFor: "Vitamins and minerals (including folic acid and iron) before, during and after pregnancy.", dose: "1 tablet daily.", caution: "Keep iron away from children." },
  { name: "promethazine with codeine", aliases: ["promethazine codeine", "promethazine-codeine"], usedFor: "Cough with cold or allergy symptoms, in adults.", dose: "5 mL every 4–6 hours as needed; maximum 30 mL in 24 hours. Not for anyone under 18.", caution: "Schedule V opioid: risk of slowed breathing, especially with other sedatives." },
  { name: "pseudoephedrine", aliases: ["sudafed"], usedFor: "Stuffy nose and sinus congestion.", dose: "60 mg every 4–6 hours (maximum 240 mg a day), or extended release 120 mg every 12 hours or 240 mg once daily.", caution: "Sold behind the counter: federal purchase limits and ID log apply." },
  { name: "quetiapine", aliases: ["seroquel"], usedFor: "Schizophrenia, bipolar disorder, and add-on treatment for depression (extended release).", dose: "Schizophrenia: 25 mg twice daily on day 1, raised to 300–400 mg a day by day 4; range 150–750 mg a day.", caution: "Boxed warning: higher death risk in elderly dementia patients; suicidal thoughts in young people." },
  { name: "rsv vaccine", aliases: ["arexvy", "abrysvo", "mresvia"], usedFor: "Preventing serious RSV lung infection in older adults and at-risk adults, and in babies through vaccination during pregnancy (Abrysvo).", dose: "One 0.5 mL intramuscular dose, per the CDC schedule (pregnancy: 32–36 weeks, Abrysvo only)." },
  { name: "rosuvastatin", aliases: ["crestor"], usedFor: "Lowering cholesterol and preventing heart disease.", dose: "10–20 mg once daily; range 5–40 mg." },
  { name: "semaglutide", aliases: ["ozempic", "wegovy", "rybelsus"], usedFor: "Type 2 diabetes (Ozempic, Rybelsus) and weight management (Wegovy).", dose: "Ozempic: 0.25 mg injected once weekly for 4 weeks, then 0.5 mg; may go up to 1 mg, then 2 mg. Wegovy goes up step by step to 2.4 mg weekly.", caution: "Boxed warning: thyroid C-cell tumors." },
  { name: "sertraline", aliases: ["zoloft"], usedFor: "Depression, OCD, panic disorder, PTSD, social anxiety and PMDD.", dose: "50 mg once daily (25 mg to start for panic, PTSD and social anxiety); maximum 200 mg.", caution: "Boxed warning: suicidal thoughts in young people." },
  { name: "shingles vaccine", aliases: ["shingrix", "zoster vaccine"], usedFor: "Preventing shingles in adults 50 and older, and adults 19 and older with weak immune systems.", dose: "2 intramuscular doses of 0.5 mL, given 2–6 months apart." },
  { name: "simvastatin", aliases: ["zocor"], usedFor: "Lowering cholesterol and preventing heart disease.", dose: "20–40 mg once daily in the evening. 80 mg only for patients already on it for a long time without muscle problems.", caution: "Many drug interactions raise muscle damage risk." },
  { name: "sitagliptin", aliases: ["januvia"], usedFor: "Type 2 diabetes.", dose: "100 mg once daily; 50 mg or 25 mg with reduced kidney function." },
  { name: "spironolactone", aliases: ["aldactone"], usedFor: "Heart failure, high blood pressure, swelling, and too much aldosterone.", dose: "Heart failure: 25 mg once daily (range 12.5–50 mg). Blood pressure: 25–100 mg a day.", caution: "Can raise potassium; check blood levels." },
  { name: "sulfamethoxazole-trimethoprim", aliases: ["bactrim", "septra", "smx-tmp", "sulfamethoxazole trimethoprim"], usedFor: "Urinary tract infections, some ear and chest infections, traveler's diarrhea, and some pneumonia.", dose: "One double-strength tablet (800/160 mg) every 12 hours; UTIs usually 3–14 days.", caution: "Sulfa: check for allergy. Can raise potassium." },
  { name: "tamsulosin", aliases: ["flomax"], usedFor: "Urinary symptoms of an enlarged prostate.", dose: "0.4 mg once daily, 30 minutes after the same meal each day; may be raised to 0.8 mg.", caution: "Dizziness when standing up." },
  { name: "tdap vaccine", aliases: ["boostrix", "adacel", "tdap"], usedFor: "Preventing tetanus, diphtheria and whooping cough.", dose: "0.5 mL intramuscular once, then Td or Tdap every 10 years. One dose in each pregnancy (27–36 weeks)." },
  { name: "testosterone cypionate", aliases: ["depo-testosterone"], usedFor: "Low testosterone in men.", dose: "50–400 mg intramuscular every 2–4 weeks (commonly 100–200 mg every 2 weeks).", caution: "Schedule III. Check blood counts and levels." },
  { name: "tiotropium inhaler", aliases: ["spiriva", "tiotropium"], usedFor: "Long-term control of COPD (and asthma, Respimat only). Not for sudden attacks.", dose: "HandiHaler: inhale the contents of one 18 mcg capsule (2 breaths) once daily. Respimat for COPD: 2 puffs (2.5 mcg each) once daily." },
  { name: "tramadol", aliases: ["ultram"], usedFor: "Pain severe enough to need an opioid.", dose: "50–100 mg every 4–6 hours as needed; maximum 400 mg a day. Starting at 25 mg and raising slowly reduces side effects.", caution: `Schedule IV. ${OPIOID} Seizure and serotonin syndrome risk.` },
  { name: "trazodone", aliases: ["desyrel"], usedFor: "Depression. (Also widely used at low doses for sleep, which is off-label.)", dose: "Depression: 150 mg a day in split doses, raised by 50 mg every 3–4 days; maximum 400 mg a day for outpatients.", caution: "Boxed warning: suicidal thoughts in young people." },
  { name: "triamcinolone acetonide", aliases: ["triamcinolone", "kenalog"], usedFor: "Eczema, dermatitis, psoriasis and other itchy, inflamed skin (cream or ointment).", dose: "Apply a thin layer 2–4 times a day. (Injections and nasal sprays are dosed differently.)" },
  { name: "valacyclovir", aliases: ["valtrex"], usedFor: "Cold sores, genital herpes and shingles.", dose: "Cold sores: 2 g twice in one day, 12 hours apart. Shingles: 1 g three times daily for 7 days. Genital herpes, first episode: 1 g twice daily for 10 days. Lower doses with kidney problems." },
  { name: "valsartan", aliases: ["diovan"], usedFor: "High blood pressure, heart failure, and after a heart attack.", dose: "Blood pressure: 80–160 mg once daily; maximum 320 mg. Heart failure: 40 mg twice daily, up to 160 mg twice daily.", caution: "Do not use in pregnancy." },
  { name: "varicella vaccine", aliases: ["varivax", "chickenpox vaccine"], usedFor: "Preventing chickenpox.", dose: "2 doses of 0.5 mL under the skin. Children: at 12–15 months and 4–6 years. Teens and adults without immunity: 4–8 weeks apart.", caution: "Live vaccine: not for pregnancy or weak immune systems." },
  { name: "venlafaxine er", aliases: ["effexor xr"], usedFor: "Depression, generalized anxiety, social anxiety and panic disorder.", dose: "75 mg once daily with food (some start at 37.5 mg for 4–7 days); maximum 225 mg a day.", caution: "Can raise blood pressure. Boxed warning: suicidal thoughts in young people." },
  { name: "vitamin d3", aliases: ["cholecalciferol", "vitamin d"], usedFor: "Vitamin D supplement for bone health and low vitamin D.", dose: "Most adults: 600–800 IU (15–20 mcg) a day. Higher doses for deficiency only as directed." },
  { name: "warfarin", aliases: ["coumadin", "jantoven"], usedFor: "Preventing and treating blood clots (atrial fibrillation, DVT, PE, mechanical heart valves).", dose: "Often 2–5 mg once daily to start, then adjusted to the INR blood test (target usually 2–3).", caution: "Boxed warning: major bleeding. Many drug and food interactions." },
  { name: "zolpidem", aliases: ["ambien"], usedFor: "Short-term trouble falling asleep.", dose: "Immediate release: 5 mg for women, 5–10 mg for men, right before bed with 7–8 hours left to sleep; maximum 10 mg.", caution: "Schedule IV. Boxed warning: sleep-walking, sleep-driving and other complex sleep behaviors." },
];

/** Lowercase, drop strengths and punctuation so "Metformin ER 500mg" → "metformin er". */
export function normalizeDrugName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\(.*?\)/g, " ")
    .replace(/\b\d[\d.,/-]*\s*(mg|mcg|g|ml|units?|iu|%)?\b/g, " ")
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Every name and alias, longest first, so "metformin er" wins over "metformin".
const LOOKUP: { key: string; info: DrugInfo }[] = DRUG_INFO.flatMap((info) =>
  [info.name, ...(info.aliases ?? [])].map((n) => ({ key: normalizeDrugName(n), info })),
).sort((a, b) => b.key.length - a.key.length);

/**
 * Find reference info for a product name. Matches when the product name
 * starts with a known name or brand (whole words), so "Insulin Glargine Pen"
 * finds "insulin glargine". Returns undefined if nothing matches.
 */
export function findDrugInfo(productName: string): DrugInfo | undefined {
  const name = normalizeDrugName(productName);
  if (!name) return undefined;
  for (const { key, info } of LOOKUP) {
    if (name === key || name.startsWith(key + " ")) return info;
  }
  return undefined;
}

/** DailyMed search link, so staff can read the full official label. */
export function dailyMedUrl(productName: string): string {
  const q = normalizeDrugName(productName) || productName;
  return `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(q)}`;
}

export const DRUG_INFO_DISCLAIMER =
  "General reference only, not medical advice. Always follow the prescription and the full product label; the pharmacist must verify the dose for each patient.";
