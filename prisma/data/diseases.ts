import type { PathogenType } from "../../src/generated/prisma/enums";

export interface DiseaseReference {
  title: string;
  url: string;
  publisher: string;
}

export interface DiseaseSeed {
  slug: string;
  name: string;
  scientificName: string | null;
  alternativeNames: string[];
  pathogenType: PathogenType;
  pathogen: string;
  description: string;
  transmission: string;
  symptoms: string;
  prevention: string;
  references: DiseaseReference[];
}

const whoFactSheet = (slug: string, title: string): DiseaseReference => ({
  title: `WHO fact sheet: ${title}`,
  url: `https://www.who.int/news-room/fact-sheets/detail/${slug}`,
  publisher: "World Health Organization",
});

/**
 * Initial disease catalog. Descriptive text summarises the cited WHO fact
 * sheets; it is reference material, not outbreak status. Being listed here
 * does not imply any current outbreak.
 */
export const diseases: DiseaseSeed[] = [
  {
    slug: "covid-19",
    name: "COVID-19",
    scientificName: "Coronavirus disease 2019",
    alternativeNames: ["Coronavirus disease 2019", "SARS-CoV-2 infection"],
    pathogenType: "VIRUS",
    pathogen: "SARS-CoV-2",
    description:
      "A respiratory disease caused by the SARS-CoV-2 coronavirus, first identified in December 2019. Illness ranges from asymptomatic infection to severe pneumonia and death; older people and those with underlying conditions are at higher risk of severe disease.",
    transmission:
      "Spreads mainly between people in close contact through respiratory particles and aerosols, and in poorly ventilated or crowded indoor settings.",
    symptoms:
      "Fever, cough, sore throat, fatigue, loss of taste or smell, and shortness of breath. Some people experience post COVID-19 condition (long COVID).",
    prevention:
      "Vaccination, improving indoor ventilation, staying home when ill, and wearing a well-fitting mask in crowded spaces.",
    references: [
      whoFactSheet(
        "coronavirus-disease-(covid-19)",
        "Coronavirus disease (COVID-19)",
      ),
    ],
  },
  {
    slug: "influenza",
    name: "Influenza",
    scientificName: null,
    alternativeNames: [
      "Flu",
      "Seasonal influenza",
      "Avian influenza",
      "Zoonotic influenza",
    ],
    pathogenType: "VIRUS",
    pathogen: "Influenza A and B viruses",
    description:
      "An acute respiratory infection caused by influenza viruses. Seasonal influenza circulates worldwide every year; zoonotic influenza viruses such as avian influenza A(H5N1) occasionally infect humans.",
    transmission:
      "Spreads through respiratory droplets and aerosols and through contaminated hands and surfaces. Zoonotic infections are usually acquired through contact with infected animals.",
    symptoms:
      "Sudden onset of fever, cough, headache, muscle and joint pain, sore throat and malaise. Severe disease and death occur mostly in high-risk groups.",
    prevention:
      "Annual vaccination, hand hygiene, covering coughs and sneezes, and avoiding contact with sick or dead animals.",
    references: [
      whoFactSheet("influenza-(seasonal)", "Influenza (seasonal)"),
      whoFactSheet(
        "influenza-(avian-and-other-zoonotic)",
        "Influenza (avian and other zoonotic)",
      ),
    ],
  },
  {
    slug: "dengue",
    name: "Dengue",
    scientificName: null,
    alternativeNames: ["Dengue fever", "Severe dengue", "Breakbone fever"],
    pathogenType: "VIRUS",
    pathogen: "Dengue virus (DENV-1 to DENV-4)",
    description:
      "A mosquito-borne viral infection common in tropical and subtropical climates. Most infections are mild or asymptomatic, but severe dengue can be fatal.",
    transmission:
      "Transmitted to people through the bites of infected Aedes mosquitoes, mainly Aedes aegypti.",
    symptoms:
      "High fever, severe headache, pain behind the eyes, muscle and joint pain, nausea, vomiting and rash. Warning signs of severe dengue include severe abdominal pain, persistent vomiting and bleeding.",
    prevention:
      "Reducing mosquito breeding sites, using repellents and protective clothing, and vaccination where recommended.",
    references: [
      whoFactSheet("dengue-and-severe-dengue", "Dengue and severe dengue"),
    ],
  },
  {
    slug: "measles",
    name: "Measles",
    scientificName: "Rubeola",
    alternativeNames: ["Rubeola"],
    pathogenType: "VIRUS",
    pathogen: "Measles virus",
    description:
      "A highly contagious viral disease that mostly affects children. It can cause serious complications including pneumonia, encephalitis and death.",
    transmission:
      "Spreads through the air when an infected person breathes, coughs or sneezes.",
    symptoms:
      "High fever, cough, runny nose, red eyes and a rash that starts on the face and upper neck and spreads downwards.",
    prevention: "Vaccination with two doses of a measles-containing vaccine.",
    references: [whoFactSheet("measles", "Measles")],
  },
  {
    slug: "cholera",
    name: "Cholera",
    scientificName: null,
    alternativeNames: [
      "Acute watery diarrhoea (when not laboratory confirmed)",
    ],
    pathogenType: "BACTERIUM",
    pathogen: "Vibrio cholerae",
    description:
      "An acute diarrhoeal infection that can kill within hours if untreated. It is closely linked to inadequate access to safe water and sanitation.",
    transmission:
      "Spread by ingesting food or water contaminated with Vibrio cholerae.",
    symptoms:
      "Most infected people have no or mild symptoms. Severe cases have profuse acute watery diarrhoea leading to severe dehydration.",
    prevention:
      "Safe water, sanitation and hygiene, food safety, and oral cholera vaccines alongside these measures.",
    references: [whoFactSheet("cholera", "Cholera")],
  },
  {
    slug: "mpox",
    name: "Mpox",
    scientificName: null,
    alternativeNames: ["Monkeypox"],
    pathogenType: "VIRUS",
    pathogen: "Monkeypox virus (MPXV), clades I and II",
    description:
      "A viral illness caused by the monkeypox virus, an orthopoxvirus. It can spread between people and occasionally from animals to people.",
    transmission:
      "Close contact with an infected person, including skin-to-skin and sexual contact; contact with contaminated materials; and contact with infected animals.",
    symptoms:
      "A rash or lesions that may last two to four weeks, often with fever, sore throat, headache, muscle aches, low energy and swollen lymph nodes.",
    prevention:
      "Avoiding close contact with people who have mpox, vaccination for people at high risk, and hand hygiene.",
    references: [whoFactSheet("mpox", "Mpox")],
  },
  {
    slug: "ebola-virus-disease",
    name: "Ebola virus disease",
    scientificName: null,
    alternativeNames: ["Ebola disease", "Ebola haemorrhagic fever", "EVD"],
    pathogenType: "VIRUS",
    pathogen: "Orthoebolaviruses (e.g. Zaire, Sudan and Bundibugyo ebolavirus)",
    description:
      "A rare but severe, often fatal illness in humans. Outbreaks have occurred mainly in sub-Saharan Africa.",
    transmission:
      "Introduced through close contact with infected animals; spreads between people through direct contact with blood or body fluids of people who are sick with or have died from the disease, and with contaminated materials.",
    symptoms:
      "Sudden fever, fatigue, muscle pain, headache and sore throat, followed by vomiting, diarrhoea, rash and in some cases internal and external bleeding.",
    prevention:
      "Infection prevention and control, safe burials, contact tracing, community engagement and, for Zaire ebolavirus, vaccination.",
    references: [whoFactSheet("ebola-disease", "Ebola disease")],
  },
  {
    slug: "marburg-virus-disease",
    name: "Marburg virus disease",
    scientificName: null,
    alternativeNames: ["Marburg haemorrhagic fever", "MVD"],
    pathogenType: "VIRUS",
    pathogen: "Marburg virus",
    description:
      "A severe, often fatal haemorrhagic fever caused by a virus in the same family as Ebola virus.",
    transmission:
      "Initially acquired from prolonged exposure to Rousettus fruit bat colonies; spreads between people through direct contact with blood, body fluids and contaminated surfaces and materials.",
    symptoms:
      "Abrupt high fever, severe headache and malaise, followed by severe watery diarrhoea, vomiting and, in many cases, haemorrhagic manifestations.",
    prevention:
      "Reducing contact with bat colonies, infection prevention and control in health care, contact tracing and safe burials.",
    references: [
      whoFactSheet("marburg-virus-disease", "Marburg virus disease"),
    ],
  },
  {
    slug: "malaria",
    name: "Malaria",
    scientificName: null,
    alternativeNames: ["Paludism"],
    pathogenType: "PARASITE",
    pathogen: "Plasmodium parasites (P. falciparum, P. vivax and others)",
    description:
      "A life-threatening disease caused by Plasmodium parasites. It is preventable and curable.",
    transmission:
      "Spread to people through the bites of infected female Anopheles mosquitoes.",
    symptoms:
      "Fever, chills and headache, usually 10-15 days after the infective bite. Severe malaria can cause organ failure and death.",
    prevention:
      "Vector control (insecticide-treated nets, indoor residual spraying), chemoprevention, and malaria vaccines for children in endemic areas.",
    references: [whoFactSheet("malaria", "Malaria")],
  },
  {
    slug: "tuberculosis",
    name: "Tuberculosis",
    scientificName: null,
    alternativeNames: ["TB"],
    pathogenType: "BACTERIUM",
    pathogen: "Mycobacterium tuberculosis",
    description:
      "A bacterial infection that most often affects the lungs. It is preventable and usually curable.",
    transmission:
      "Spreads through the air when people with active lung TB cough, sneeze or spit.",
    symptoms:
      "Prolonged cough (sometimes with blood), chest pain, weakness, weight loss, fever and night sweats.",
    prevention:
      "Early diagnosis and treatment, TB preventive treatment, infection control, and BCG vaccination of infants in high-burden settings.",
    references: [whoFactSheet("tuberculosis", "Tuberculosis")],
  },
  {
    slug: "polio",
    name: "Poliomyelitis",
    scientificName: "Poliomyelitis",
    alternativeNames: [
      "Polio",
      "Wild poliovirus",
      "Circulating vaccine-derived poliovirus (cVDPV)",
    ],
    pathogenType: "VIRUS",
    pathogen: "Poliovirus",
    description:
      "A highly infectious viral disease that mainly affects children under five and can cause irreversible paralysis.",
    transmission:
      "Spread person to person, mainly through the faecal-oral route or, less frequently, through contaminated water or food.",
    symptoms:
      "Most infections cause no symptoms. Some people have fever, fatigue, headache and limb pain; a small proportion develop paralysis.",
    prevention: "Vaccination with polio vaccines, given multiple times.",
    references: [whoFactSheet("poliomyelitis", "Poliomyelitis")],
  },
  {
    slug: "yellow-fever",
    name: "Yellow fever",
    scientificName: null,
    alternativeNames: [],
    pathogenType: "VIRUS",
    pathogen: "Yellow fever virus",
    description:
      "An acute viral haemorrhagic disease transmitted by infected mosquitoes, endemic in tropical areas of Africa and Central and South America.",
    transmission:
      "Transmitted by the bites of infected Aedes and Haemagogus mosquitoes.",
    symptoms:
      "Fever, muscle pain, headache, loss of appetite, nausea or vomiting. A small proportion enter a toxic phase with jaundice and bleeding.",
    prevention: "A single dose of yellow fever vaccine, plus mosquito control.",
    references: [whoFactSheet("yellow-fever", "Yellow fever")],
  },
  {
    slug: "chikungunya",
    name: "Chikungunya",
    scientificName: null,
    alternativeNames: [],
    pathogenType: "VIRUS",
    pathogen: "Chikungunya virus (CHIKV)",
    description:
      "A mosquito-borne viral disease that causes fever and severe, often debilitating joint pain.",
    transmission:
      "Transmitted by the bites of infected Aedes aegypti and Aedes albopictus mosquitoes.",
    symptoms:
      "Abrupt fever and severe joint pain, often with muscle pain, headache, nausea, fatigue and rash. Joint pain can persist for months.",
    prevention:
      "Reducing mosquito breeding sites and protecting against mosquito bites.",
    references: [whoFactSheet("chikungunya", "Chikungunya")],
  },
  {
    slug: "zika-virus-disease",
    name: "Zika virus disease",
    scientificName: null,
    alternativeNames: ["Zika", "Zika fever"],
    pathogenType: "VIRUS",
    pathogen: "Zika virus",
    description:
      "A mosquito-borne viral infection. Most infections are mild, but infection during pregnancy can cause microcephaly and other congenital abnormalities.",
    transmission:
      "Primarily through bites of infected Aedes mosquitoes; also from mother to fetus during pregnancy, through sexual contact and through blood transfusion.",
    symptoms:
      "Usually mild: rash, fever, conjunctivitis, muscle and joint pain, malaise and headache.",
    prevention:
      "Protection against mosquito bites and mosquito control; safer sex practices in affected areas.",
    references: [whoFactSheet("zika-virus", "Zika virus")],
  },
  {
    slug: "plague",
    name: "Plague",
    scientificName: null,
    alternativeNames: [
      "Bubonic plague",
      "Pneumonic plague",
      "Septicaemic plague",
    ],
    pathogenType: "BACTERIUM",
    pathogen: "Yersinia pestis",
    description:
      "A bacterial zoonosis usually found in small mammals and their fleas. It can be fatal without prompt antibiotic treatment.",
    transmission:
      "Bites of infected fleas, direct contact with infected tissues, and, for pneumonic plague, inhalation of infected respiratory droplets.",
    symptoms:
      "Sudden fever, chills, headache, body aches, weakness, vomiting and nausea. Bubonic plague causes painful swollen lymph nodes.",
    prevention:
      "Avoiding flea bites and contact with dead animals, and early antibiotic treatment of cases and contacts.",
    references: [whoFactSheet("plague", "Plague")],
  },
  // Added because WHO Disease Outbreak News reports on them regularly.
  {
    slug: "mers",
    name: "Middle East respiratory syndrome",
    scientificName: null,
    alternativeNames: ["MERS", "MERS-CoV infection"],
    pathogenType: "VIRUS",
    pathogen: "MERS coronavirus (MERS-CoV)",
    description:
      "A viral respiratory disease caused by a coronavirus first identified in Saudi Arabia in 2012. Infection ranges from no symptoms to severe respiratory illness and death.",
    transmission:
      "Zoonotic: dromedary camels are the main reservoir. Limited human-to-human transmission occurs through close contact, mostly in health-care settings.",
    symptoms:
      "Fever, cough and shortness of breath; pneumonia is common. Some people have gastrointestinal symptoms.",
    prevention:
      "Hygiene around camels, avoiding raw camel milk and undercooked meat, and infection prevention and control in health care.",
    references: [
      whoFactSheet(
        "middle-east-respiratory-syndrome-coronavirus-(mers-cov)",
        "Middle East respiratory syndrome coronavirus (MERS-CoV)",
      ),
    ],
  },
  {
    slug: "crimean-congo-haemorrhagic-fever",
    name: "Crimean-Congo haemorrhagic fever",
    scientificName: null,
    alternativeNames: ["CCHF"],
    pathogenType: "VIRUS",
    pathogen: "Crimean-Congo haemorrhagic fever virus (Nairovirus)",
    description:
      "A widespread tick-borne viral disease that can cause severe haemorrhagic fever outbreaks.",
    transmission:
      "Tick bites (mainly Hyalomma ticks), contact with blood or tissues of infected animals during and after slaughter, and human-to-human contact with blood or body fluids.",
    symptoms:
      "Sudden fever, muscle ache, dizziness, neck pain, headache and vomiting, followed in severe cases by bleeding.",
    prevention:
      "Avoiding tick bites, protective measures when handling livestock, and infection control in health care.",
    references: [
      whoFactSheet(
        "crimean-congo-haemorrhagic-fever",
        "Crimean-Congo haemorrhagic fever",
      ),
    ],
  },
  {
    slug: "nipah-virus-disease",
    name: "Nipah virus disease",
    scientificName: null,
    alternativeNames: ["Nipah virus infection", "NiV"],
    pathogenType: "VIRUS",
    pathogen: "Nipah virus (Henipavirus)",
    description:
      "A zoonotic viral disease that can cause severe respiratory illness and fatal encephalitis. Outbreaks occur mainly in Bangladesh and India.",
    transmission:
      "From fruit bats directly or via contaminated food such as raw date palm sap, from infected pigs, and between people through close contact.",
    symptoms:
      "Fever, headache, muscle pain, vomiting and sore throat, potentially followed by encephalitis, seizures and coma.",
    prevention:
      "Avoiding raw date palm sap and contact with sick animals, and infection control when caring for patients.",
    references: [whoFactSheet("nipah-virus", "Nipah virus")],
  },
  {
    slug: "hantavirus-disease",
    name: "Hantavirus disease",
    scientificName: null,
    alternativeNames: [
      "Hantavirus pulmonary syndrome",
      "Haemorrhagic fever with renal syndrome",
    ],
    pathogenType: "VIRUS",
    pathogen: "Orthohantaviruses",
    description:
      "Diseases caused by hantaviruses carried by rodents, including hantavirus pulmonary syndrome in the Americas and haemorrhagic fever with renal syndrome in Europe and Asia.",
    transmission:
      "Mainly by inhaling particles contaminated with rodent urine, droppings or saliva. Andes virus can also spread between people.",
    symptoms:
      "Fever, fatigue and muscle aches, which may progress to severe breathing difficulty or kidney failure depending on the virus.",
    prevention:
      "Rodent control and avoiding exposure to rodent excreta, including when cleaning enclosed spaces.",
    references: [whoFactSheet("hantavirus", "Hantavirus")],
  },
  {
    slug: "diphtheria",
    name: "Diphtheria",
    scientificName: null,
    alternativeNames: [],
    pathogenType: "BACTERIUM",
    pathogen: "Corynebacterium diphtheriae (toxin-producing strains)",
    description:
      "A bacterial infection whose toxin can damage the airway, heart and nerves. It is vaccine-preventable.",
    transmission:
      "Respiratory droplets and close contact; also contact with infected skin lesions.",
    symptoms:
      "Sore throat, fever and swollen neck glands, with a grey membrane in the throat that can block breathing.",
    prevention:
      "Vaccination with diphtheria-containing vaccines, including booster doses.",
    references: [whoFactSheet("diphtheria", "Diphtheria")],
  },
  {
    slug: "rift-valley-fever",
    name: "Rift Valley fever",
    scientificName: null,
    alternativeNames: ["RVF"],
    pathogenType: "VIRUS",
    pathogen: "Rift Valley fever virus (Phlebovirus)",
    description:
      "A viral zoonosis that mainly affects livestock and can also infect people, occasionally causing severe disease.",
    transmission:
      "Contact with blood or organs of infected animals and bites of infected mosquitoes. No human-to-human transmission has been documented.",
    symptoms:
      "Usually a mild flu-like illness; a small proportion develop eye disease, encephalitis or haemorrhagic fever.",
    prevention:
      "Animal vaccination, protective measures when handling animals, and protection from mosquito bites.",
    references: [whoFactSheet("rift-valley-fever", "Rift Valley fever")],
  },
  {
    slug: "anthrax",
    name: "Anthrax",
    scientificName: null,
    alternativeNames: [],
    pathogenType: "BACTERIUM",
    pathogen: "Bacillus anthracis",
    description:
      "A bacterial zoonosis mainly of herbivorous animals that can infect people exposed to infected animals or their products.",
    transmission:
      "Contact with infected animals or animal products, eating contaminated meat, or inhaling spores. It does not usually spread between people.",
    symptoms:
      "Depends on the route: skin lesions with a black centre, gastrointestinal illness, or severe respiratory illness.",
    prevention:
      "Livestock vaccination, safe disposal of carcasses, and not handling or eating meat from animals that died suddenly.",
    references: [whoFactSheet("anthrax", "Anthrax")],
  },
  {
    slug: "rabies",
    name: "Rabies",
    scientificName: null,
    alternativeNames: [],
    pathogenType: "VIRUS",
    pathogen: "Rabies virus (Lyssavirus)",
    description:
      "A vaccine-preventable viral disease of the central nervous system that is almost always fatal once symptoms appear.",
    transmission:
      "Mostly through bites or scratches from infected animals, dogs in the vast majority of human cases.",
    symptoms:
      "Fever and pain or tingling at the wound, followed by progressive inflammation of the brain and spinal cord.",
    prevention:
      "Vaccinating dogs, prompt wound washing and post-exposure prophylaxis after a bite, and pre-exposure vaccination for people at high risk.",
    references: [whoFactSheet("rabies", "Rabies")],
  },
  {
    slug: "meningitis",
    name: "Meningitis",
    scientificName: null,
    alternativeNames: [
      "Meningococcal disease",
      "Invasive meningococcal disease",
    ],
    pathogenType: "BACTERIUM",
    pathogen:
      "Mainly Neisseria meningitidis, Streptococcus pneumoniae and Haemophilus influenzae (also viruses and fungi)",
    description:
      "Inflammation of the membranes around the brain and spinal cord, most often caused by infection. Bacterial meningitis can cause epidemics and is often fatal or disabling.",
    transmission:
      "The main bacterial causes spread person to person through respiratory droplets or throat secretions.",
    symptoms:
      "Fever, headache, stiff neck, confusion, sensitivity to light and, with meningococcal infection, a rash.",
    prevention:
      "Vaccination against the main bacterial causes and antibiotic prophylaxis for close contacts.",
    references: [whoFactSheet("meningitis", "Meningitis")],
  },
  {
    slug: "lassa-fever",
    name: "Lassa fever",
    scientificName: null,
    alternativeNames: [],
    pathogenType: "VIRUS",
    pathogen: "Lassa virus (Arenavirus)",
    description:
      "An acute viral haemorrhagic illness endemic in parts of West Africa.",
    transmission:
      "Exposure to food or household items contaminated with urine or faeces of infected Mastomys rats; also person to person in health-care settings.",
    symptoms:
      "Most infections are mild or asymptomatic; severe cases have fever, weakness, bleeding, breathing difficulty and shock.",
    prevention:
      "Rodent control and food hygiene, and infection prevention and control in health care.",
    references: [whoFactSheet("lassa-fever", "Lassa fever")],
  },
  {
    slug: "oropouche-virus-disease",
    name: "Oropouche virus disease",
    scientificName: null,
    alternativeNames: ["Oropouche fever"],
    pathogenType: "VIRUS",
    pathogen: "Oropouche virus (Orthobunyavirus)",
    description:
      "An arboviral disease in the Americas that causes a dengue-like febrile illness.",
    transmission:
      "Mainly through bites of infected midges (Culicoides paraensis) and some mosquitoes.",
    symptoms:
      "Sudden fever, headache, muscle and joint pain, chills and sometimes vomiting; symptoms can recur.",
    prevention:
      "Protection against midge and mosquito bites and vector control.",
    references: [
      whoFactSheet("oropouche-virus-disease", "Oropouche virus disease"),
    ],
  },
];
