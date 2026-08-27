/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Phase 4: one createEntityStore(...) call per domain entity — the generic
 * factory (./store.ts) written once, instantiated 33 times. Each entity's
 * repository is exported by name; server/domain/migrateLegacy.ts and the
 * test fixtures are the only current callers (Phase 4 deliberately doesn't
 * wire these into the existing flows/API yet — see the plan's "out of
 * scope" section).
 */
import {
  OrganizationSchema,
  ContactSchema,
  FundSchema,
  InvestmentVehicleSchema,
  InvestmentMandateSchema,
  DealTeamSchema,
} from "./entities/parties";
import {
  CompanySchema,
  OpportunitySchema,
  DealSchema,
  SourceSchema,
  ResearchFindingSchema,
  ScreeningAssessmentSchema,
} from "./entities/pipeline";
import {
  FinancialPeriodSchema,
  FinancialMetricSchema,
  ValuationCaseSchema,
  CapitalStructureSchema,
  CapTableSchema,
  DebtFacilitySchema,
  ReturnsCaseSchema,
} from "./entities/financials";
import { DiligenceWorkstreamSchema, DiligenceRequestSchema, RiskAndMitigantSchema } from "./entities/diligence";
import { ICMemorandumSchema, ICDecisionSchema, ApprovalConditionSchema, TransactionMilestoneSchema } from "./entities/ic";
import {
  PortfolioInvestmentSchema,
  PortfolioKPISchema,
  ValueCreationInitiativeSchema,
  FollowOnDecisionSchema,
  ExitScenarioSchema,
  RealisedProceedsSchema,
} from "./entities/portfolio";
import { InvestmentArtifactSchema } from "./entities/artifact";
import { createEntityStore } from "./store";

// -- parties --
export const organizations = createEntityStore("Organization", "organizations.json", OrganizationSchema);
export const contacts = createEntityStore("Contact", "contacts.json", ContactSchema);
export const funds = createEntityStore("Fund", "funds.json", FundSchema);
export const investmentVehicles = createEntityStore("InvestmentVehicle", "investment-vehicles.json", InvestmentVehicleSchema);
export const investmentMandates = createEntityStore("InvestmentMandate", "investment-mandates.json", InvestmentMandateSchema);
export const dealTeams = createEntityStore("DealTeam", "deal-teams.json", DealTeamSchema);

// -- pipeline --
export const companies = createEntityStore("Company", "companies.json", CompanySchema);
export const opportunities = createEntityStore("Opportunity", "opportunities.json", OpportunitySchema);
export const deals = createEntityStore("Deal", "deals.json", DealSchema);
export const sources = createEntityStore("Source", "sources.json", SourceSchema);
export const researchFindings = createEntityStore("ResearchFinding", "research-findings.json", ResearchFindingSchema);
export const screeningAssessments = createEntityStore("ScreeningAssessment", "screening-assessments.json", ScreeningAssessmentSchema);

// -- financials --
export const financialPeriods = createEntityStore("FinancialPeriod", "financial-periods.json", FinancialPeriodSchema);
export const financialMetrics = createEntityStore("FinancialMetric", "financial-metrics.json", FinancialMetricSchema);
export const valuationCases = createEntityStore("ValuationCase", "valuation-cases.json", ValuationCaseSchema);
export const capitalStructures = createEntityStore("CapitalStructure", "capital-structures.json", CapitalStructureSchema);
export const capTables = createEntityStore("CapTable", "cap-tables.json", CapTableSchema);
export const debtFacilities = createEntityStore("DebtFacility", "debt-facilities.json", DebtFacilitySchema);
export const returnsCases = createEntityStore("ReturnsCase", "returns-cases.json", ReturnsCaseSchema);

// -- diligence --
export const diligenceWorkstreams = createEntityStore("DiligenceWorkstream", "diligence-workstreams.json", DiligenceWorkstreamSchema);
export const diligenceRequests = createEntityStore("DiligenceRequest", "diligence-requests.json", DiligenceRequestSchema);
export const risksAndMitigants = createEntityStore("RiskAndMitigant", "risks-and-mitigants.json", RiskAndMitigantSchema);

// -- investment committee --
export const icMemoranda = createEntityStore("ICMemorandum", "ic-memoranda.json", ICMemorandumSchema);
export const icDecisions = createEntityStore("ICDecision", "ic-decisions.json", ICDecisionSchema);
export const approvalConditions = createEntityStore("ApprovalCondition", "approval-conditions.json", ApprovalConditionSchema);
export const transactionMilestones = createEntityStore("TransactionMilestone", "transaction-milestones.json", TransactionMilestoneSchema);

// -- portfolio --
export const portfolioInvestments = createEntityStore("PortfolioInvestment", "portfolio-investments.json", PortfolioInvestmentSchema);
export const portfolioKPIs = createEntityStore("PortfolioKPI", "portfolio-kpis.json", PortfolioKPISchema);
export const valueCreationInitiatives = createEntityStore(
  "ValueCreationInitiative",
  "value-creation-initiatives.json",
  ValueCreationInitiativeSchema
);
export const followOnDecisions = createEntityStore("FollowOnDecision", "follow-on-decisions.json", FollowOnDecisionSchema);
export const exitScenarios = createEntityStore("ExitScenario", "exit-scenarios.json", ExitScenarioSchema);
export const realisedProceeds = createEntityStore("RealisedProceeds", "realised-proceeds.json", RealisedProceedsSchema);

// -- artifacts --
export const investmentArtifacts = createEntityStore("InvestmentArtifact", "investment-artifacts.json", InvestmentArtifactSchema);
