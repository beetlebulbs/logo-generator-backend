import express from "express";
import supabase from "../database/supabase.js";
import { sendFormLeadEmail } from "../pdf-templates/formLeadMailer.js";

const router = express.Router();

// readable label maps
const BRAND_MAP = {
  company: "Company",
  brand: "Brand",
  product: "Product",
  app: "App",

  new: "New Business",
  existing: "Existing Brand",
  rebrand: "Rebranding",

  naming: "Naming & Positioning",
  identity: "Logo & Visual Identity",
  packaging: "Product / Packaging",
  complete: "Complete Brand System"
};

router.post("/", async (req, res) => {
  try {
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

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email required" });
    }

    if (!service) {
      return res.status(400).json({ error: "Service missing" });
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

    const { error } = await supabase.from("formleads").insert([
      {
        service: finalService,

        name,
        email,
        phone,
        country,
        state_region: stateRegion || null,
        zip_code: zipCode || null,

        identity_for: BRAND_MAP[identityFor] || identityFor || null,
        brand_stage: BRAND_MAP[brandStage] || brandStage || null,
        brand_requirement:
          BRAND_MAP[brandRequirement] || brandRequirement || null,
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

    res.json({ success: true });

    // async email (non-blocking)
    setImmediate(() => {
      sendFormLeadEmail({
        service: finalService,

        name,
        email,
        phone,
        country,
        stateRegion,
        zipCode,

        identityFor:
          BRAND_MAP[identityFor] || identityFor,
        brandStage:
          BRAND_MAP[brandStage] || brandStage,
        brandRequirement:
          BRAND_MAP[brandRequirement] || brandRequirement,
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