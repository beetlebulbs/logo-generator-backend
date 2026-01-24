import express from "express";
import supabase from "../database/supabase.js";
import { sendFormLeadEmail } from "../pdf-templates/formLeadMailer.js";

const router = express.Router();

// ===============================
// READABLE LABEL MAPS
// ===============================

// Brand Identity
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

// Digital Presence
const DIGITAL_MAP = {
  website: "Website / Landing Pages",
  ecommerce: "E-commerce Platform",
  app: "Web / Mobile App",
  system: "Complete Digital System",

  leads: "Lead Generation",
  sales: "Online Sales",
  automation: "Automation",
  scale: "Scaling",

  none: "No Website / No Digital Presence",
  basic: "Basic Website (No Leads)",
  template: "Template-based Website",
  ads_only: "Running Ads Without System",
  advanced: "Website + Multiple Tools",
  messy: "Too Many Tools, No Clarity",
  unsure: "Not Sure / Need Audit"
};

// Growth Engine
const GROWTH_MAP = {
  under_50k: "Under ₹50,000",
  "50k_2l": "₹50,000 – ₹2,00,000",
  "2l_5l": "₹2,00,000 – ₹5,00,000",
  "5l_plus": "₹5,00,000+",

  leads: "More Quality Leads",
  conversion: "Better Conversion",
  customers: "Predictable Customers",
  scale: "Scale Revenue",

  low_quality: "Low Lead Quality",
  high_cost: "High Cost, Low Sales",
  sales_issue: "Sales Team Struggling",
  no_predictability: "No Predictability"
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

    // ===============================
    // BASIC VALIDATION
    // ===============================
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

    // ===============================
    // SAVE TO SUPABASE (READABLE TEXT)
    // ===============================
    const { error } = await supabase.from("formleads").insert([
      {
        service: finalService,

        name,
        email,
        phone,
        country,
        state_region: stateRegion || null,
        zip_code: zipCode || null,

        // Brand Identity
        identity_for: BRAND_MAP[identityFor] || identityFor || null,
        brand_stage: BRAND_MAP[brandStage] || brandStage || null,
        brand_requirement:
          BRAND_MAP[brandRequirement] || brandRequirement || null,
        industry: industry || null,

        // Digital Presence
        digital_requirement:
          DIGITAL_MAP[digitalRequirement] || digitalRequirement || null,
        digital_goal:
          DIGITAL_MAP[digitalGoal] || digitalGoal || null,
        existing_setup:
          DIGITAL_MAP[existingSetup] || existingSetup || null,

        // Growth Engine
        marketing_spend:
          GROWTH_MAP[marketingSpend] || marketingSpend || null,
        primary_goal:
          GROWTH_MAP[primaryGoal] || primaryGoal || null,
        biggest_challenge:
          GROWTH_MAP[biggestChallenge] || biggestChallenge || null,
        business_type: finalBusinessType || null
      }
    ]);

    if (error) {
      console.error("❌ SUPABASE INSERT ERROR:", error);
      return res.status(500).json({ error: "Supabase insert failed" });
    }

    // respond fast
    res.json({ success: true });

    // ===============================
    // EMAIL (ASYNC, CLEAN DATA)
    // ===============================
    setImmediate(() => {
      sendFormLeadEmail({
        service: finalService,

        name,
        email,
        phone,
        country,
        stateRegion,
        zipCode,

        // Brand
        identityFor:
          BRAND_MAP[identityFor] || identityFor,
        brandStage:
          BRAND_MAP[brandStage] || brandStage,
        brandRequirement:
          BRAND_MAP[brandRequirement] || brandRequirement,
        industry,

        // Digital
        digitalRequirement:
          DIGITAL_MAP[digitalRequirement] || digitalRequirement,
        digitalGoal:
          DIGITAL_MAP[digitalGoal] || digitalGoal,
        existingSetup:
          DIGITAL_MAP[existingSetup] || existingSetup,

        // Growth
        marketingSpend:
          GROWTH_MAP[marketingSpend] || marketingSpend,
        primaryGoal:
          GROWTH_MAP[primaryGoal] || primaryGoal,
        biggestChallenge:
          GROWTH_MAP[biggestChallenge] || biggestChallenge,
        businessType: finalBusinessType
      });
    });

  } catch (err) {
    console.error("❌ FORM LEAD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;