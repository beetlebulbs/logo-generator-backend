import express from "express";
import supabase from "../database/supabase.js";
import { sendFormLeadEmail } from "../pdf-templates/formLeadMailer.js";

const router = express.Router();

/* ✅ PREFLIGHT SAFETY */
router.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.sendStatus(200);
});

router.post("/", async (req, res) => {
  try {
    /* ===============================
       EXTRACT FULL PAYLOAD
    ================================ */
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
        state_region: stateRegion || null,
        zip_code: zipCode || null,

        identity_for: identityFor || null,
        brand_stage: brandStage || null,
        brand_requirement: brandRequirement || null,
        industry: industry || null,

        digital_requirement: digitalRequirement || null,
        digital_goal: digitalGoal || null,
        existing_setup: existingSetup || null,

        marketing_spend: marketingSpend || null,
        primary_goal: primaryGoal || null,
        biggest_challenge: biggestChallenge || null,
        business_type: finalBusinessType || null
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
