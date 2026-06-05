import { db } from './src/config/db.js'

const pathologyTestsData = [
  'Absolute CD3', 'Absolute CD4', 'Absolute CD19', 'ANCA MPO', 'Bladder Pre & Post Void', 'PIK3CA', 'chlamydia-IgA', 'T/Dht Ratio', 'C A Test', 'Usg Afc (Antral Follicle Counts)', 'Sobt(Stool occult blood test)', 'H1N1 Test', 'ANCA PR3', 'Ena Profile Qualitative', 'Blood C/S Bactec', 'EBV IgG', 'EBV IgM', 'Schober Test', 'Ro60', 'Ro60 IgG', 'Ro60 IgM', 'Ro52', 'Ro52 IgG', 'Ro52 IgM', 'CCP', 'Anti-Ro52', 'Anti-Ro60', 'Folate Test', 'Phosphorus (Po4)', 'Thyroid Function Tests', 'Urine Sensitivity', 'Procalcitonin Test', 'Kidney Function test(KFT)', 'Complete Hormone Test', 'Blood Urea', 'Immunogram Test', 'Serum Uric Acid', 'Beta 2 Microglobulin (B2m)', 'Thyriod Profile', 'Natriuretic Peptide Tests (Bnp, Nt-Pro Bnp)', 'IgM', 'Rhesus Factor Test (Rh)', 'Sodium(Na+)', 'Blood Culture Test( Blood C/S)', 'IgE', 'Abo & Rh Factor Test', 'Serum Calcium', 'Typhidot-IgM', 'Thyroid Profile', 'Typhidot Igg', 'Vitamin E', 'Chikungunya Serology Igm', 'Antistreptolysin O Titer (Aso) Test', 'Creatine Phosphokinase-Mb (Cpk-Mb)', 'Urine Routine Examination', 'Urine Albumin To Creatinine Ratio (Acr)', 'LSCS', 'Bleeding Time Clotting Time (Btct)', 'Fibroscan Test', 'Thyroid Function Test', 'Aft Test ( Autonomic Function Test )', 'CA - 125', 'HbeAg (Hepatitis B e-Antigen)', 'T4(Thyroxine)', 'T3(triiodothyronine).', 'Rubella-IgG', 'Protein total', 'Vitamin B12', 'AMH', 'Cytomegalo virus IgM', 'Phosphorous', 'Lipoprotein (A)', 'Estradiol / Oestrogen', 'Rubella - IgM', 'NEOT', 'SGPT', 'PPBS', 'Rheumatoid Factor (RF)', 'Herpes Simplex Virus - IgM', 'CEA', 'Apolipoprotein B', 'Folic Acid', 'TOXO GOND II - IgG', 'Apolipoprotein A1', 'Blood Urea Nitrogen', 'Chloride', 'Testosterone', 'Anti dsDNA', 'TSH', 'ACL - IgM', 'Total Cholesterol', 'Anti HAV - IgM', 'Prolactin', 'ANA', 'FSH', 'Uric acid', 'PSA', 'Blood Element Analysis Profile', 'Beta - Thalassemia Screening', 'Calcium', 'Insulin', 'Free Thyroxine (FT4)', 'Progesterone', 'Ferritin', 'Homocysteine', 'Toxo Gond II / IgM', 'Free Triiodothyronine (T3)', 'ACL - IgG', 'AFP', 'Beta HCG', 'PTH', 'Vitamin D (Total)', 'LH(Luteinizing Hormone)', 'TIBC(Total iron binding capacity)', 'Amylase', 'CD3/CD4/CD8', 'Lipase', 'HS-CRP', 'BUN(Blood Urea Nitrogen)', 'C3(Complement)', 'Anti phospholipid antibody (APL) - IgM', 'Anti HSV', 'Bilirubin Total', 'FBS(Fasting blood sugar)', 'HLA B27', 'SGOT', 'Alkaline Phosphatase', 'ASO', 'Hemogram - 6 Part (Diff)', 'Respiratory Rate', '% Transfferin Saturation', '17 OH Progesterone', 'Activated Protein-C', 'Adenosine Deaminase', 'Androstenedione (A4)', 'Anti Beta 2 Glycoprotein', 'Anti Cardiolipin Antibodies', 'Anti glomerular basement membrane protein - IgG', 'Anti HCV', 'Anti Hepatitis A virus (HAV) - Total', 'Anti Hepatitis B Core Antigen (AHBc) - IgM', 'Anti Hepatitis B Core Antigen (AHBc) - total', 'Anti Hepatitis B Envelope Antigen (AHBe)- Total', 'Anti Hepatitis B Surface Antigen (AHBS) - Total', 'Anti HEV - IgM', 'Anti SCL - 70 Antibody', 'Anti sperm Antibody (ASAB)', 'Anti Thrombin III', 'Antichlamydia antibody (IGG)', 'Antichlamydia antibody (IGM)', 'Antithyroglobulin Antibody ( ATG )', 'APO B / APO A1 ratio', 'Arsenic', 'B2 Microglonulin', 'Barium', 'Basophils', 'Basophils Absolute count', 'Beta 2 Glycoprotein 1 - IgG', 'Beta 2 Glycoprotein 1 - IgM', 'Bilateral Mammography', 'Bilirubin Direct', 'Bilirubin Indirect', 'Blood Urea Nitrogen / Serum Creatinine Ratio', 'BOH Profile', 'CA 15.3', 'CA 19.9', 'Cadmium', 'Caesium', 'Carbamazepine/Tegretol', 'Cardiolipin Antibody (ACL) IgA', 'Cobalt', 'CBC', 'Chromium', 'CMV - IgG', 'Cortisol', 'cystatin C', 'D-Dimer', 'Dengue - IgG', 'Dengue - IgM', 'Dengue NS1 Antigen', 'DHEA Sulphate', 'DLC', 'DNA FRAGMENTATION (Male)', 'Dual Markers', 'Eosinophils', 'AEC (Absolute Eosinophils count)', 'ESR', 'Estradiol (Male)', 'Faber test', 'FACTOR V Leiden', 'Free PSA', 'Free Testosterone', 'Fructose', 'FSH', 'FT/ LCS', 'G5 PD', 'Gamma Glutamyl Transferase (GGT)', 'GBP', 'Glucose-6-Phosphate Dehydrogenase', 'Hb Electrophorasis', 'HbsAg', 'HCV', 'HCV (Male)', 'HDL Cholesterol Direct', 'Helicobacter Pylori - IgA', 'Helicobacter Pylori - IgG', 'Hematocrit (PCV)', 'Hemoglobin A2', 'Hemoglobin C', 'Hemoglobin D', 'Hemoglobin F', 'Hemoglobin S', 'Herpes Simplex Virus I (HSV) - IgG', 'Herpes Simplex Virus I (HSV) - IgM', 'Herpes Simplex Virus II (HSV) IgG', 'Herpes Simplex Virus II (HSV) IgM', 'HIV I & II', 'Hiv I & II (Male)', 'HSV - IgG', 'Human Growth Hormone (HGH)', 'Immature Granulocytes (IG)', 'Immature Granulocytes % (IG % )', 'Immunoglobulin A (IgA)', 'Immunoglobulin G (IgG)', 'Immunoglobulin M (IgM)', 'Inhibin A', 'INR', 'Intravenous Urography', 'Lactate Dehydrogenase', 'LDH', 'LDL / HDL Ratio', 'LDL cholesterol Direct', 'Lead', 'Leptospira - IgM', 'Liver function test (LFT)', 'LH (Male)', 'Lipid Profile', 'Liver Kidney Microsomes', 'Liver ProfileVit', 'Lp-PLA2', 'Lymphocytes Percentage', 'Magnesium', 'Malarial Antigen', 'Mantoux Test', 'Mean Corpuscular Hemoglobin ( MCH )', 'Mean Corpuscular Hemoglobin concentration ( MCHC )', 'Mean Corpuscular Volume ( MCV )', 'Mean Platelet Volume ( MPV )', 'Mercury', 'Monocytes', 'Monocytes Absolute count', 'MP', 'MP antigen', 'MPO - ANCA (p-ANCA)', 'Neutrophils', 'Neutrophils Absolute count', 'Non HDL Cholesterol', 'Nucleated RBC', 'Nucleated RBC %', 'Phenytoin/Dilantin/Eptoin', 'Platelet Count(PLTS)', 'Platelet Distribution Width ( PDW )', 'Platelet to Large Cell Ratio ( PLCR )', 'Plateletcrit (PCT)', 'Potassium(K+)', 'PR 3 - ANCA (c-ANCA)', 'Pregnancy associated Plasma protein A', 'PROGRESSIVE MOTILITY (Male)', 'Prolactin (Male)', 'Protein-C', 'Protein-S', 'Prosthesis', 'PTT', 'Pulmonary Function Test', 'Random Blood Sugar ( RBS )', 'Red Cell Distribution Width - SD (RD W - SD)', 'Red Cell Distribution Width (RD W - CV)', 'Copper', 'Vitamin B12', 'Vitamin D', 'Zinc', 'Selenium', 'Serum Albumin', 'Serum Albumin / Globulin Ratio', 'Serum Globulin', 'Sex Hormone Binding Globulin (SHBG)', 'SGOT', 'SGPT', 'SLR', 'Sperm count', 'Sputum AFP', 'Sputum test', 'SRL Lt', 'SRL Rt', 'TB Gold', 'TC / HDL Cholesterol Ratio', 'Testosterone', 'Testosterone/Estradiol Ratio', 'Thyroglobulin (TG)', 'TIBC', 'Total Erythrocytes', 'Total Leucocytes Count', 'TPO', 'Treponema Pallidum Antibody (TPAB)', 'Treponema Pallidum Haemagglutination', 'Triglycerides(TG)', 'Tromeophila Profile', 'TRUS', 'TSH', 'TSP', 'Typhoid Culture Test', 'unconjugated Estriol (E3)', 'Valgus-Patellar Tracking', 'Valproic acid', 'Varus/Valgus', 'VDRL', 'VDRL (Male)', 'Vitamin A', 'Vitamin B1', 'Vitamin B2', 'Vitamin B3', 'Vitamin B5', 'Vitamin B6', 'Vitamin B7', 'Vitamin D1 / 25 - dihydroxy', 'Vitamin D3', 'Vitamin K', 'VLDL Cholesterol', 'Widal test', 'ELISA', 'PAP smear', 'ACTH', 'ALP', 'ALBERTS STAIN', 'Amylase test', 'ANA TEST', 'ANC PROFILE', 'ANCA PROFILE', 'COOMBS TEST', 'CPK', 'Double marker test', 'Fungal culture test', 'globulin test', 'glucose tolarance test', 'gram stain test', 'helicobacter pylori test', 'peripheral blood smear test', 'pleural fluid test', 'Prothrombin Time and International Normalized Ratio (PT/INR)', 'rubella test', 'sputum test', 'RT PCR ANTIGEN', 'Rapid diagnostic test (RDT)', 'COVID TEST-Swab Test Nasal aspirate', 'TRIPLE MARKER TEST', 'Troponin test', 'Typhidot', 'A1C test', 'Allergy shots', 'Allergy skin tests', 'Antinuclear antibody', 'BPDDS', 'BRCA gene test', 'BUN test', 'Basal body temperature', 'Bilirubin test', 'Blood urea nitrogen (BUN) test', 'Body contouring', 'Bone density test', 'Braces dental', 'C-reactive protein test', 'CA 125 test', 'CBT', 'COVID-19 antibody testing', 'COVID-19 serology testing', 'COVID-19 tests', 'CRP test', 'Cholesterol test', 'Chorionic villus sampling', 'Cologuard test', 'Complete blood count (CBC)', 'Complete cholesterol test', 'Concussion testing', 'Coronavirus disease 2019 antibody testing', 'Coronavirus disease 2019 diagnostic testing', 'Cytochrome P450 tests', 'ESR', 'Erythrocyte sedimentation rate', 'FES', 'Fecal occult blood test', 'Ferritin test', 'Fetal blood sampling', 'Fetal fibronectin test', 'First trimester screening', 'Four-marker screen', 'Glucose challenge test', 'Glucose tolerance test', 'Glycated hemoglobin test', 'Glycosylated hemoglobin test', 'HIV testing', 'HPV test', 'HbA1C', 'Hematocrit test', 'Hemoccult test', 'Hemoglobin A1C test', 'Human papillomavirus test', 'Lipid panel', 'Liposuction', 'Liver function tests', 'Microalbumin test', 'NIPS (See: NIPS also known asPrenatal cell-free DNA screening)', 'Nitric oxide test for asthma', 'Nonstress test', 'Nuclear cardiology stress test', 'Nuclear stress test', 'PSA test', 'Percutaneous umbilical blood sampling', 'Polysomnography Sleep Study', 'Prostate-specific antigen test', 'Prothrombin time test', 'Quadruple marker test', 'Rheumatoid factor', 'Sedimentation rate', 'Skin allergy test', 'Sleep study', 'Stress test', 'Testicular exam', 'Thallium stress test', 'Tilt table test', 'Vision testing', 'TIBC', 'CBC', 'Lipid Profile', 'Sputum test', 'PAP smear', 'ANA TEST', 'Duration of Flow', 'Anti phospholipid antibody (APL) - IgG', 'Anti CCP', 'TTG - IgA', 'LMP', 'Lupus anticoagulants', 'Lymphocytes Absolute count', 'Lymphocytes Percentage', 'Urea', 'Urine culture', 'Urine Microscopy', 'Urine PCR', 'Urine Pregnancy Test (UPT)', 'Urine Routine', 'Urinalysis', 'Urine cytology', 'spot urine protein to creatinine ratio', 'Urinary Microalbumin', 'Stool for OB', 'Stool R/M', 'stool culture test', 'stool routine', 'Stool DNA test', 'Hbe Level', 'Vitamin C', 'Urine Protein Creatinine Ratio', 'Nt-Pro Bnp Test', 'Anti Hepatitis E Virus Test ( H E V)', 'Peripheral Blood Film ( P B F)', 'Pus Test For Culture & Sensitivity', 'Histopathological Examination (Hpe)', 'Acid-Fast Bacilli Test Or A F B Test', 'Hemogram', '24-Hour Urine Protein Test', 'Luteinizing Hormone (Lh) Test', 'Ethylenediamine Tetraacetic Acid (Edta)', 'Tissue Transglutaminase (Ttga) Antibody', 'Metabolic Profile Test', 'Serum Electrolyte Test', 'Complete Urine Examination', 'Peripheral Smear (PS)', 'Aspartate Aminotransferase (AST)', 'Sputum AFP Test', 'Capillary Blood Glucose (Cbg)', 'Igf Binding Protein-3', 'Visual Acuity Checkup', 'Tuberculosis (Tb-Pcr) Test', 'Schirmer Test', 'Fundus Examination', 'Ds-Dna Antibody', 'Hba Ag Antibody', 'Visual Field', 'Troponin I', 'Fluoride Plasma', 'Blood Workup Test', 'C 3', 'Anti-Ds D N A', 'C 4', 'Extractable Nuclear Antigen (ENA Profile)', 'Macular Optical Coherence Tomograph (Oct)', '24 Hours Urinary Copper', 'Ceruloplasmin Test', 'Haptoglobin(Hp) Card Test', 'Stool Exam', 'Torch Profile', 'Antistreptolysin O (Aso)', 'ANCA Test', 'Activated Partial Thromboplastin Time Test(Aptt)', 'Urine Calcium', 'Urine Creatinine', 'IPTH Test', '250 HD Test', 'Arterial Blood Gases Test (Abg)', 'Fish Test (Fluorescence In Situ Hybridization)', 'Venous Blood Gas', 'Mtx Test', 'Vision Assest', 'Hematology', '25 Hydroxy Test', 'RDW Blood Test', 'CSF Test', 'Beta 2GP', 'Urine Calcium / Creatinine Ratio', 'Acp', 'Iron Profile', 'Serum Total Ige', 'Urinary Creatinine Ratio', 'Sputum Culture', 'Serum Gh', 'Serum Igf', 'Serum Immunoglobulin E (Ige)', 'Gh Serum Test', 'Serum Cortisol Test', 'Stress Echocardiography', 'Coagulation Profile', 'Viral Marker', 'Sputum Zn Test', 'Aldosterone Renin Ratio', '24 Hour Urine Metanephrines Test', 'Rapid Plasma Reagin Test', 'Serum ACE', 'Serum Iron', 'Blood Urine Sugar', 'Urobilinogen(Ubg) Test', 'Inhibin B', 'Karyotype Test', 'Serum Ammonia', 'Pro-BNP', 'Tbg Blood Test', 'Refraction Test', 'Dmsa (Dimercapto Succinic Acid)', 'Glomerular Filtration Rate (Gfr)', 'Hgm Test', 'Intact Parathyroid Hormone Test', 'Pth Intact', 'Sensitivity Analysis', 'Visual Perception', 'Visual Light', 'Carbon Monoxide test', 'Oral Glucose Tolerance Test ( Ogtt)', 'Uroflow & Post Void Residual', 'Void Residual Urine', 'Serum Analysis', 'Blood Test', 'Stool For Ova And Cyst Test', 'Polymerase Chain Reaction (Pcr)', 'Hla B5', 'Rheumatoid Factor', 'Plasma Metanephrines Test', 'Filarial Antigen', 'Filarial Antibody', 'HBV Dna Test', '24 Hour Urine Protein Test', 'Urine Spot Potassium(S) Test', 'Urine Spot Sodiumtest', 'Homocysteine Test', 'Ingress Protection Test', 'Total Protein Albumin Test', 'Acetylcholine Antibody Test', 'Transferrin Saturation (Ts)', 'Absolute Eosinophil Count', 'Serum Insulin Level', 'Vasculitis Profile', 'B2GP Test', 'Genitogram Test', 'N-Terminal Pro Hormone Bnp (Nt-Probnp)', 'Gh Stimulation Test', 'Serum Galactomannan Test', 'Urine Toxicology Test', 'Hepatitis B Surface Antigen (Hbsag)', 'Hbv Dna', 'Stool Fat Estimation', 'D Xylose Test', 'P-Anca Test', 'C-Anca Test', 'Anti-Lkm-1', 'HCV Rna', 'Hbv Dna Test', 'Estimated Glomerular Filtration Rate(eGFR)', 'Urinary Vma Test', 'Radiofrequency Ablation', 'Hormone Profile', 'Ena Screen', 'Immunoglobulin Test', 'Molecular Panel', 'Cytogenetics', 'Lipopolysaccharides (Lps)', 'Lactate Dehydrogenase (Ldh)', 'Malarial Parasite', 'Venous Blood Gas', '170 Hp Test', 'Blood Urea', 'Stool Antigen Test', 'Urine Protein Electrophoresis', 'Serum Protein Electrophoresis', 'Ocular Counter Roll', 'Optical Coherence Tomography (OCT)', '17-Hydroxyprogesterone', 'Serum Catecholamines', 'Serum Protein Electrophoresis Test', 'Extractable Nuclear Antigen Antibodies', 'Platelet Count Test', 'Cerebral Vasomotor Regulation In Atrial Fibrillation (Cvr-Af)', 'Hmf Test', 'Anti TPO', 'Bcm Test', 'Serology Hiv', '24 Hour Urine Calcium', 'Serum Testosterone', 'Horizontal Gaze Nystagmus (Hgn)', 'Antithrombin Iii', 'Maternal Hiv', 'Thiopurine Methyltransferase (Tpmt)', 'Protein S', 'Protein C', 'Reticulocyte', 'Serum Ceruloplasmin', 'DLCO', 'Uro Test', 'Mp Qbc', 'Urine Active Sediment', 'High Performance Liquid Chromatography (Hplc)', 'Indirect Coombs Test (LCT)', 'Direct Coombs Test (DCT)', 'Creatine Kinase Mb(CK-Mb)', 'Bcr-Abl', 'Bcr-Abl Genetic', 'Serum Phenytoin', 'Sputum Genexpert Test', 'Virtual Reality (V R)Test', 'Reticulocyte Count', 'Comprehensive Metabolic Panel (CMP)', 'Multiplex Ligation Probe Amplification (MLPA)', 'Valproate Level', 'Anti Ttg Iga', '24 Hour Urine Albumin Test', 'Survival Motor Neuron (Smn) Gene Test', 'Creatine Phosphokinase', 'Serum Valproate Fasting', 'Koch Test', 'Anemia Profile', 'Blood Urine', 'Serum Lithium Level', 'Autoimmune Profile', 'Serum Folate', '24 Hours Creatinine Test', '17-OHP', 'Monoclonal Band', 'Serum Free Light Chain Assay (Sflc)', 'Schirmer\'S Test', 'Serum Protein Electrophoresis', 'Very Long Chain Fatty Acid (Vlcfa)', 'Ferritin Test', 'Routine Sputum', 'Sputum Microscopy Test', 'Fasting Lipid Profile', 'Clotting Screening With Mixing Study', 'Cerebrospinal Fluid (Csf) -Routine & Microscopy', 'Cerebrospinal Fluid (Csf) -Culture And Sensitivity Test', 'Serum Alpha Fetoprotein', 'VFA', 'Heparin-Induced Thrombocytopenia', 'Nystagmus', 'Serum And Urine Protein Electrophoreses', 'Serum Everolimus Level', 'Bacterial Culture Test', 'Adenosine Deaminase Test', 'Growth Hormone Test', 'Igf-1 (Insulin-Like Growth Factor 1)', 'Hepatitis C', 'Carbamazepine Test', 'Serum Protein Electrophoresis (Spep)', 'Urine Protein Electrophoresis (Upep)', 'Serum Protein Electrophoresis (Spep) Test', 'Total Iron Binding Capacity', 'Anti-Streptolysin', 'Plasma Renin Aldosterone Ratio Test', 'Angiotensin-Converting Enzyme Level', 'Anti Streptolysin O', 'Fasting Lipid Profile', 'Anti-Dnase B', 'Intraocular Pressure(Iop)', 'Kayser Fleischer (K F) Ring Test', '25-Hydroxy Vitamin D', 'Thoracic Aortic Aneurysm Workup', 'Anti HCV Albumine', 'Cmv Igm', 'Serum Immunofixation Electrophoresis', 'Engrailed Homeobox (En1) 1 Profile', 'Serum Paraneoplastic', 'ALS', 'Anti Musk Antibodies Test', 'Sputum - AFB', 'Endomysial Antibodies-IgA', '(Hla)Human Leukocyte Antigen- Dq2/Dq8', 'Tissue Transglutaminase Iga (Ttg-Iga)', 'Urine Spot Albumin', 'Stool Parasite', 'Dystrophy Gene Testing', 'Thyrotropin-Releasing Hormone', 'Dengue Test', 'Anti Hepatitis B Core Antigen ( Igg)', 'Sputum Gram Stain', 'Partial Thromboplastin Time With Kaolin', 'Serological Profile', 'Sputum Koh', 'Anti Microsomal Antibody', 'Liver Kidney Microsomal Antibody Test', 'Smooth Muscle Antibody', 'Glucose-6-Phosphate Dehydrogenase', 'Anticardiolipin Antibodies', 'Extracetable Nuclear Antigen Antibody (Ena) Profile', 'CCT', 'Reticulocyte Count', 'Serum Phenobarbitone Level', 'Alanine Transaminase(Alt) Test', 'Semen Analysis', 'Thyroxine (T4)', 'Random Urine Test', 'Intact Parathyroid Hormone (Ipth)', 'Serum Eptoin Level', 'Direct Antiglobulin Test (Dat)', 'CRP', 'Visual Field Constriction', 'Thrombophilia Workup Test', 'Differential Count ( DC) Test', 'CA-125', 'Halm Test', 'Chem Test', 'Serum Digoxin Level', 'Urine Analysis', 'TAC Level', 'Pus Culture', 'Serum Protein Test', 'Blood Ammonia', 'Fasting Plasma Glucose', 'Photoplethysmography', 'Urine Albumin-Creatinine Ratio (Uacr)', 'KP1', 'Allergy Profile', 'Urine M Band', 'Renal Panel', 'Fastest Absolute Eosinophil Count', 'Hepatitis B', 'Human Menopausal Gonadotropin', 'Triiodothyronine (T3)', 'Humphrey Visual Field(HVF)', 'Paraneoplastic Panel', 'Dihydrotestosterone', 'Serum Erythropoietin Test', 'Pcos Profile', 'Anti La/Ssb', 'C-Peptide Test', 'Testosterone Total', 'ANF Test', 'Antral Follicle Count', 'Haptoglobin-Related Protein (Hpr)', 'Couple Karyotype Test', 'Anti Thyroglobulin Antibody', 'Fasting Ammonia Levels', 'Retinal Nerve Fibre Layer (Rnfl)', 'Central Corneal Thickness', 'Post Mydriatic Test', 'ANA (Ifa)', 'Sputum AFB', 'Haemogram', 'Iron Studies', '24 Hour Urine Protein Creatinine Clearance', 'Spot Urine Osmolality', 'Pentacam', 'Lactulose Level Test', 'MH Panel Test', 'Aspergillus Igg', 'Quantitative (Rq-Pcr)', 'ONA', 'Fructosamine', 'Ocular Microtremor (Omt)', 'Bicarbonate', 'Anti-Tissue Transglutaminase Antibody', 'Igras', 'Retina Test', 'Anti-Pla2r Antibodies', 'Fecal Calprotectin', 'Complement (C4)', 'Complement (C3)', 'Urine Osmolality', 'TAC Level', 'Serum Osmolality', 'Urine Sodium', 'Anti-U1rnp', 'Anti -Ssa', 'Urine Ph Test', 'Urine Calcium Spot', 'Optic Nerve Head (Onh)', 'Atrial Natriuretic Peptide(Anp)', 'Ace Level (Angiotensin Converting Enzyme)', 'Glutamic Acid Decarboxylase 65-Kilodalton Isoform (Gad65) Antibody', 'PCR', 'Bkv Quantitative Pcr', 'Spot Urine Albumin-To-Creatinine Acr', 'Basic Metabolic Panel (Bmp)', 'Kidney Panel', 'Amoebic Serology', 'Tsh Receptor Antibody', 'Anti Ccp Antibodies', 'Cyclosporine Level', 'Arthritis Profile', 'Complete Hemogram Test', 'Anti-Ro/Ssa', 'Peripheral Smear - Malarial Parasite', 'Serum Beta-Hydroxybutyrate', 'Igg G4', 'Myeloproliferative Neoplasm (Mpn) Profile', 'Extractable Nuclear Antigen Profile', 'Antibiotic Sensitivity Test', 'Anti Cardiolipin Antibody Igm', 'Anti Cardiolipin Antibody Igg', 'HCV AB', 'Anti HAV', 'Pivka-II', 'Hbv Dna Quantitative (Viral Load)', 'Cd3/Cd4', 'Foreign Body Surface', 'E T', 'Antineutrophil Cytoplasmic Antibodies', 'Anti- Transglutaminase Antibody Ttg Iga', 'Transglutaminase Antibody Iga', 'Ketones Urine', 'Stool Reducing Substance', 'Serum Lactate', 'Serum Prolactin', 'C2 Level', 'Blood Ketostix', 'Anti Rnp', 'Anti Ssb', 'Estradiol (E2) Test', 'Pla2r-Ab', 'Bile Acid', 'ANC Panel', 'Throat Swab', 'Urine Albumin', 'Blood Culture /Sensitivity For S. Typhi', 'Serum Insulin Post Prandial', 'Ugt', 'Serum Insulin Fasting', 'Tdap Blood Test', 'Cmv Dna Quantitative Pcr', 'Anti-Tt4 Antibody', 'Serum Calcium Total And Ionic', 'Thalassemia Profile', 'Anti Hav Igg', 'S. Psa Total', 'Scrub Typhus Igm', 'Phadiatop Test', 'Anti Tpo Antibodies', 'Ab4', 'Anti Tsh Receptor Ab', 'Chromosomal Analysis', 'Sputum For Afb Direct Smear And Calture', 'Sputum For Pyrogenic & Fungus Direct Smear & Culture', 'Urine Ketone', 'Anti Hcv Igm', 'Acetylcholine Receptor (Achr) Antibody', 'Dengue Serology', 'S. Psa Free', 'Plasma Acth', 'HEV Igm', 'Transcutaneous Bilirubin (Tcb)', 'Stool Sensitivity', 'Stool For Occult Blood', 'Spth', 'Anti Hbe Antibody', 'Aspergillus Specific Ige', 'Cct Test', 'Ama(Antimitochondrial Antibody )', 'Ionized Calcium', 'Anti Ssa', 'Thymus Storage Factor (Tsf)', 'Fasting C Peptide', 'Chikungunya Igm', 'Apt', 'Anti Intrinsic Factor Antibody', 'Anti Parietal Cell Antibody', 'Sputum - Cervical Tuberculous', 'Tissue Polypeptide Antigen (Tpa)', 'HFT', 'Anti-Hbc', 'Sputum Sensitivity', 'Quantiferon Gold -Tb', 'Carcinoembryonic Antigen (Cea)', 'Fecal Elastase Level', 'Spot Urine Microalbumin To Creatinine Ratio', 'Chikungunya Igg', 'Hbt With Glucose', 'Hbc Igg', 'Estrogen', 'Partial F-Test', 'Serum Transferrin', 'Thyroid Antibodies Test', 'Hco3', 'TPO Antibodies', 'Sga', 'Abg', 'H Ttg -Dgp', 'Aerobic Blood C/S', 'Stool Microscopic', 'Clotting Time', 'Spot Urine Sodium', 'Partial Thromboplastin Time', 'Clusters Of Differentiation 4 (Cd4) Count', 'Glucose Challenge Test Fasting', 'Glucose Challenge Test Postprandial', 'Blood Culture', 'Procollagen Type I N-Propeptide (Pinp)', 'Antiphospholipid Antibody', 'Lipid Anticoagulant', 'Anti Thrombin 2', 'Urine Spot Pcr', 'AVR', 'Semen Culture', 'Semen Sensitivity', 'Mpda', 'Hs Troponin 1', 'Procalcitonin', 'P Anca', 'C Anca'
]

function categorizeTest(testName) {
  const name = testName.toLowerCase()

  // Determine category and specimen type
  let testCategory = 'hematology'
  let specimenType = 'blood'

  if (name.includes('urine')) {
    testCategory = 'urinalysis'
    specimenType = 'urine'
  } else if (name.includes('stool')) {
    testCategory = 'stool'
    specimenType = 'stool'
  } else if (name.includes('csf') || name.includes('cerebrospinal')) {
    testCategory = 'body fluid'
    specimenType = 'csf'
  } else if (name.includes('sputum')) {
    testCategory = 'respiratory'
    specimenType = 'sputum'
  } else if (name.includes('semen') || name.includes('motility') || name.includes('count')) {
    testCategory = 'semen'
    specimenType = 'semen'
  } else if (name.includes('culture') || name.includes('sensitivity') || name.includes('gram')) {
    testCategory = 'microbiology'
    specimenType = 'blood'
  } else if (name.includes('serology') || name.includes('igg') || name.includes('igm') || name.includes('antibody') || name.includes('hiv') || name.includes('hcv')) {
    testCategory = 'serology'
    specimenType = 'blood'
  } else if (name.includes('thyroid') || name.includes('hormone')) {
    testCategory = 'endocrinology'
    specimenType = 'blood'
  } else if (name.includes('lipid') || name.includes('cholesterol')) {
    testCategory = 'lipids'
    specimenType = 'blood'
  } else if (name.includes('kidney') || name.includes('creatinine') || name.includes('urea')) {
    testCategory = 'renal'
    specimenType = 'blood'
  } else if (name.includes('liver') || name.includes('sgot') || name.includes('sgpt') || name.includes('bilirubin')) {
    testCategory = 'liver'
    specimenType = 'blood'
  } else if (name.includes('blood') || name.includes('hemogram') || name.includes('cbc') || name.includes('hemoglobin')) {
    testCategory = 'hematology'
    specimenType = 'blood'
  }

  return { testCategory, specimenType }
}

async function seedPathologyBulk() {
  try {
    console.log('🧪 PATHOLOGY SEEDING STARTED')
    console.log(`📊 Total tests to seed: ${pathologyTestsData.length}\n`)

    const orgId = 'org-demo'
    let successCount = 0
    let errorCount = 0
    const errors = []

    for (let i = 0; i < pathologyTestsData.length; i++) {
      const testName = pathologyTestsData[i].trim()

      if (!testName) continue

      try {
        const { testCategory, specimenType } = categorizeTest(testName)
        const testId = `lab-${testName.toLowerCase().replace(/\s+/g, '-').replace(/[()[\]]/g, '').substring(0, 50)}`
        const testCode = `LAB${String(i + 1).padStart(4, '0')}`

        await db.labTest.upsert({
          where: { id: testId },
          update: {
            testName,
            testCode,
            testCategory,
            specimenType,
            isActive: true,
          },
          create: {
            id: testId,
            organizationId: orgId,
            testName,
            testCode,
            testCategory,
            specimenType,
            price: 500,
            isActive: true,
          },
        })

        successCount++
        if ((i + 1) % 100 === 0) {
          console.log(`⏳ Progress: ${i + 1}/${pathologyTestsData.length} tests processed...`)
        }
      } catch (err) {
        errorCount++
        errors.push({ test: testName, error: err.message.substring(0, 100) })
        if (errors.length <= 5) {
          console.log(`⚠️  Error: ${testName} - ${err.message.substring(0, 80)}`)
        }
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('📊 PATHOLOGY SEEDING COMPLETE')
    console.log('='.repeat(70))
    console.log(`✅ Successfully seeded: ${successCount} tests`)
    console.log(`❌ Failed: ${errorCount} tests`)
    console.log(`\n🎉 Laboratory catalog updated with pathology data!`)

    if (errors.length > 5) {
      console.log(`\n(Showing first 5 errors of ${errors.length} total errors)`)
    }

    process.exit(successCount > 0 ? 0 : 1)
  } catch (err) {
    console.error('❌ Critical error:', err.message)
    process.exit(1)
  }
}

seedPathologyBulk()
