import express from "express";
import supabase from "../database/supabase.js";
import { sendFormLeadEmail } from "../pdf-templates/formLeadMailer.js";

const router = express.Router();
const clean = (v) =>
  typeof v === "string" && v.trim() === "" ? null : v;
// ✅ BYPASS fileUpload FOR THIS ROUTE ONLY
router.use((req, res, next) => {
  req.files = null;
  next();
});

router.post("/", async (req, res) => {
  try {
    /* ===============================
       EXTRACT FULL PAYLOAD
    ================================ */
     console.log("BODY RECEIVED 👉", req.body);
    const {
      service,

      name,
      email,
      phone,
      country,
      stateRegion,
      zipCode,

      identityFor,
      brandStage,
      brandRequirement,
      industry,

      digitalRequirement,
      digitalGoal,
      existingSetup,

      marketingSpend,
      primaryGoal,
      biggestChallenge,
      businessType,
      otherBusinessType
    } = req.body;

    /* ===============================
       BASIC VALIDATION
    ================================ */
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email required" });
    }

    const finalBusinessType =
      businessType === "other" ? otherBusinessType : businessType;
      
const SERVICE_LABEL_MAP = {
  brand: "Brand Identity",
  digital: "Digital Presence",
  growth: "Growth Engine"
};

const finalService =
  SERVICE_LABEL_MAP[service] || service;
    /* ===============================
       SAVE TO SUPABASE
    ================================ */
  const { error } = await supabase.from("formleads").insert([
  {
    service: finalService,

    name,
    email,
    phone,
    country,
    state_region: clean(stateRegion),
    zip_code: clean(zipCode),

    identity_for: clean(identityFor),
    brand_stage: clean(brandStage),
    brand_requirement: clean(brandRequirement),
    industry: clean(industry),

    digital_requirement: clean(digitalRequirement),
    digital_goal: clean(digitalGoal),
    existing_setup: clean(existingSetup),

    marketing_spend: clean(marketingSpend),
    primary_goal: clean(primaryGoal),
    biggest_challenge: clean(biggestChallenge),
    business_type: clean(finalBusinessType)
  }
]);


    if (error) {
      console.error("❌ SUPABASE INSERT ERROR:", error);
      return res.status(500).json({ error: "Supabase insert failed" });
    }

    /* ===============================
       RESPOND FAST
    ================================ */
    res.json({ success: true });

    /* ===============================
       EMAIL (ASYNC, NON-BLOCKING)
    ================================ */
    setImmediate(() => {
      sendFormLeadEmail({
        service,
        name,
        email,
        phone,
        country,
        stateRegion,
        zipCode,

        identityFor,
        brandStage,
        brandRequirement,
        industry,

        digitalRequirement,
        digitalGoal,
        existingSetup,

        marketingSpend,
        primaryGoal,
        biggestChallenge,
        businessType: finalBusinessType
      });
    });

  } catch (err) {
    console.error("❌ FORM LEAD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
