import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import OpenAI from "openai";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

// Load env synchronously before using it
if (!process.env.OPENAI_API_KEY) {
	const keyEnvPath = path.resolve(process.cwd(), "key.env");
	if (fs.existsSync(keyEnvPath)) {
		dotenv.config({ path: keyEnvPath });
	}
}

export const researchRouter = router({
	ask: publicProcedure
		.input(
			z.object({
				// Primary identity used in prompt
				name: z.string().min(2),
				// Optional additional CRM context
				email: z.string().email().optional(),
				mobilePhone: z.string().optional(),
				workPhone: z.string().optional(),
				homePhone: z.string().optional(),
				city: z.string().optional(),
				state: z.string().optional(),
				title: z.string().optional(),
				company: z.string().optional(), // school/district name
				companySize: z.string().optional(), // enrollment
				companyLinkedIn: z.string().url().optional()
			})
		)
		.mutation(async ({ input }) => {
			if (!process.env.OPENAI_API_KEY) {
				throw new Error("Missing OPENAI_API_KEY. Add it to key.env or .env");
			}

			// Prefer a safe default if an unknown/placeholder model is configured
			const configuredModel = process.env.OPENAI_MODEL;
			const model =
				!configuredModel || /^gpt-5(\b|[-_.])/i.test(configuredModel)
					? "gpt-4o-mini"
					: configuredModel;

			const client = new OpenAI({
				apiKey: process.env.OPENAI_API_KEY
			});

			const contextParts: string[] = [];
			contextParts.push(`Person: ${input.name}`);
			if (input.title) contextParts.push(`Title: ${input.title}`);
			if (input.email) contextParts.push(`Email: ${input.email}`);
			if (input.mobilePhone) contextParts.push(`Mobile Phone: ${input.mobilePhone}`);
			if (input.workPhone) contextParts.push(`Work Phone: ${input.workPhone}`);
			if (input.homePhone) contextParts.push(`Home Phone: ${input.homePhone}`);
			if (input.city) contextParts.push(`City: ${input.city}`);
			if (input.state) contextParts.push(`State: ${input.state}`);
			if (input.company) contextParts.push(`School/District: ${input.company}`);
			if (input.companySize) contextParts.push(`Student Population: ${input.companySize}`);
			if (input.companyLinkedIn)
				contextParts.push(`School LinkedIn: ${input.companyLinkedIn}`);

			// The model should return ONLY derived fields; we will merge with known CSV defaults
			const derivedSchema = z.object({
				superintendentTenure: z.string().optional(),
				intermediateSchoolDistrict: z.string().optional(),
				ruralClassification: z.string().optional(),
				districtWebsite: z.string().optional(),
				personLinkedIn: z.string().optional(),
				noteworthyBackground: z.string().optional(),
				news: z
					.array(
						z.object({
							title: z.string(),
							url: z.string(),
							summary: z.string()
						})
					)
					.optional()
			});

			const prompt = [
				"Use the following CRM context to inform your answer.",
				"You are provided the individual’s name and the school's LinkedIn/company info. Strongly anchor your answers to these.",
				"Never invent phone numbers, emails, or URLs. If unknown after careful consideration, return the string 'Unknown'. Do NOT include citations, footnotes, or markdown links anywhere in the output.",
				"",
				"CRM Context:",
				...contextParts.map((p) => `- ${p}`),
				"",
				"Task:",
				"1) Use the provided School/District name and the School LinkedIn (if present) to determine the official district website and confirm current superintendent details where possible.",
				"2) Use the individual's first and last name, their title, and the employer (school/district) to identify their personal LinkedIn profile (NOT the company page). Only return if highly confident.",
				"3) Find notable recent news about the school/district (prefer last 12 months) from credible sources.",
				`4) For 'noteworthyBackground', write an in-depth multi-sentence summary specifically about ${input.name} as ${input.title} at ${input.company || "the district"}. Focus on current role, tenure, prior roles, education, initiatives, and notable achievements. Use details consistent with the district’s official site and the provided LinkedIn context. Avoid speculation.`,
				"5) Think carefully before answering; avoid 'Unknown' unless you cannot reasonably determine the item.",
				"",
				"Return ONLY a JSON object with these keys (omit any you cannot improve). Do not include any URLs in news items:",
				JSON.stringify({
					superintendentTenure: "<string>",
					intermediateSchoolDistrict: "<string>",
					ruralClassification: "<string>",
					districtWebsite: "<string>",
					personLinkedIn:
						"<the individual's personal LinkedIn profile URL if highly confident; otherwise 'Unknown'>",
					noteworthyBackground: "<string>",
					news: [
						{
							title: "<headline>",
							url: "<plain absolute article URL (no markdown, no tracking params)>",
							summary: "<1-2 sentence summary>"
						}
					]
				}, null, 2),
				"",
				"Guidelines for personLinkedIn:",
				"- Do NOT use the company's LinkedIn.",
				"- Name must match (allow common nicknames) and employer should match the provided school/district.",
				"- Prefer profiles whose current position matches the provided title and employer.",
				"- If not confident, return 'Unknown'.",
				"",
				"Guidelines for news:",
				"- Up to 3 notable items from credible sources related to the school/district in the last 12 months.",
				"- Include the article URL as a plain URL string (e.g., https://example.com/path).",
				"- Do NOT format as markdown links. Avoid [text](url) or any brackets.",
				"- Remove tracking query parameters (utm_*, ref, fbclid) from URLs when possible.",
				"- If uncertain or not available, return an empty array [].",
				"",
				"Output strictly the JSON object, with no markdown or additional text."
			].join("\n");

			// Simplest implementation: always use OpenAI Responses API with web_search tool
			const resp = await (client as any).responses.create({
				model,
				input: prompt,
				tools: [{ type: "web_search" }],
				tool_choice: "required"
			});
			let raw = resp?.output_text || "";
			// Strip markdown fences if present
			if (raw.startsWith("```")) {
				raw = raw.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
			}

			let parsed: z.infer<typeof derivedSchema> | null = null;
			try {
				const candidate = JSON.parse(raw);
				parsed = derivedSchema.parse(candidate);
			} catch {
				parsed = null;
			}

			// Sanitize helper to remove markdown links and parenthetical source blobs
			const sanitizeText = (value: string | undefined): string | undefined => {
				if (!value) return value;
				let out = value;
				// Remove parenthetical blocks that contain a markdown link e.g. ([text](url))
				out = out.replace(/\(\s*\[[^\]]+\]\([^)]+\)\s*\)/g, "");
				// Replace any remaining markdown links [text](url) with just 'text' (or remove if it's clearly a source domain)
				out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, p1) => {
					// If p1 looks like a domain, drop it entirely to avoid showing sources
					if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(p1)) return "";
					return String(p1);
				});
				// Collapse extra spaces created by removals
				out = out.replace(/\s{2,}/g, " ").trim();
				return out;
			};

			// Build final result by merging CSV-known defaults with model-derived fields
			const finalResult = {
				schoolDistrictName: input.company || "Unknown",
				superintendentFullName: input.name || "Unknown",
				superintendentTitle: input.title || "Unknown",
				superintendentTenure: sanitizeText(parsed?.superintendentTenure) || "Unknown",
				intermediateSchoolDistrict:
					sanitizeText(parsed?.intermediateSchoolDistrict) || "Unknown",
				phoneNumber:
					input.workPhone || input.mobilePhone || input.homePhone || "Unknown",
				emailAddress: input.email || "Unknown",
				totalEnrollment: input.companySize || "Unknown",
				ruralClassification: sanitizeText(parsed?.ruralClassification) || "Unknown",
				noteworthyBackground: sanitizeText(parsed?.noteworthyBackground) || "Unknown",
				districtWebsite: parsed?.districtWebsite || "Unknown",
				personLinkedIn: parsed?.personLinkedIn || "Unknown",
				news:
					(parsed?.news || []).map((n) => ({
						title: sanitizeText(n.title) || "",
						url: n.url || "",
						summary: sanitizeText(n.summary) || ""
					})) || []
			};

			return finalResult;
		})
	,
	// Batch endpoint: dedupe by school/district first (school-level info),
	// then gather person-level info and combine. Reduces total LLM calls.
	batch: publicProcedure
		.input(
			z.object({
				rows: z.array(
					z.object({
						firstName: z.string(),
						lastName: z.string(),
						email: z.string().optional(),
						mobilePhone: z.string().optional(),
						workPhone: z.string().optional(),
						homePhone: z.string().optional(),
						city: z.string().optional(),
						state: z.string().optional(),
						title: z.string().optional(),
						company: z.string().optional(),
						companySize: z.string().optional(),
						companyLinkedIn: z.string().url().optional()
					})
				)
			})
		)
		.mutation(async ({ input }) => {
			if (!process.env.OPENAI_API_KEY) {
				throw new Error("Missing OPENAI_API_KEY. Add it to key.env or .env");
			}
			const configuredModel = process.env.OPENAI_MODEL;
			const model =
				!configuredModel || /^gpt-5(\b|[-_.])/i.test(configuredModel)
					? "gpt-4o-mini"
					: configuredModel;
			const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

			// Helper: sanitize markdown links and parenthetical sources
			const sanitizeText = (value: string | undefined): string | undefined => {
				if (!value) return value;
				let out = value;
				out = out.replace(/\(\s*\[[^\]]+\]\([^)]+\)\s*\)/g, "");
				out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, p1) => {
					if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(p1)) return "";
					return String(p1);
				});
				out = out.replace(/\s{2,}/g, " ").trim();
				return out;
			};

			type SchoolInfo = {
				districtWebsite?: string;
				intermediateSchoolDistrict?: string;
				totalEnrollment?: string;
				ruralClassification?: string;
				news?: { title: string; url: string; summary: string }[];
			};

			const schoolSchema = z.object({
				districtWebsite: z.string().optional(),
				intermediateSchoolDistrict: z.string().optional(),
				totalEnrollment: z.string().optional(),
				ruralClassification: z.string().optional(),
				news: z
					.array(
						z.object({
							title: z.string(),
							url: z.string(),
							summary: z.string()
						})
					)
					.optional()
			});

			const personSchema = z.object({
				superintendentTenure: z.string().optional(),
				personLinkedIn: z.string().optional(),
				personProfileUrl: z.string().optional(),
				noteworthyBackground: z.string().optional()
			});

			// Build unique schools
			const uniqueSchools = Array.from(
				new Set(
					input.rows
						.map((r) => (r.company || "").trim())
						.filter((s) => s.length > 0)
				)
			);

			// Fetch school-level info in parallel
			const schoolMap = new Map<string, SchoolInfo>();
			await Promise.all(
				uniqueSchools.map(async (school) => {
					const exampleRow =
						input.rows.find((r) => (r.company || "").trim() === school) ||
						input.rows[0];
					const context = [
						`School/District: ${school}`,
						exampleRow.state ? `State: ${exampleRow.state}` : "",
						exampleRow.companyLinkedIn ? `School LinkedIn: ${exampleRow.companyLinkedIn}` : ""
					]
						.filter(Boolean)
						.join("\n- ");
					const prompt = [
						"Use web search to find the official district website and recent credible news.",
						"Return ONLY JSON, no markdown:",
						JSON.stringify(
							{
								districtWebsite:
									"<plain absolute URL of official district site if identifiable>",
								intermediateSchoolDistrict: "<string>",
								totalEnrollment: "<string>",
								ruralClassification: "<string>",
								news: [
									{
										title: "<headline>",
										url: "<plain absolute article URL>",
										summary: "<1-2 sentence summary>"
									}
								]
							},
							null,
							2
						),
						"",
						"Context:",
						`- ${context}`,
						"",
						"Do NOT include citations or markdown links."
					].join("\n");

					const resp = await (client as any).responses.create({
						model,
						input: prompt,
						tools: [{ type: "web_search" }],
						tool_choice: "required"
					});
					let raw = resp?.output_text || "";
					if (raw.startsWith("```")) {
						raw = raw.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
					}
					let parsed: z.infer<typeof schoolSchema> | null = null;
					try {
						parsed = schoolSchema.parse(JSON.parse(raw));
					} catch {
						parsed = null;
					}
					const info: SchoolInfo = {
						districtWebsite: parsed?.districtWebsite,
						intermediateSchoolDistrict: sanitizeText(parsed?.intermediateSchoolDistrict),
						totalEnrollment: parsed?.totalEnrollment,
						ruralClassification: sanitizeText(parsed?.ruralClassification),
						news:
							parsed?.news?.map((n) => ({
								title: sanitizeText(n.title) || "",
								url: n.url || "",
								summary: sanitizeText(n.summary) || ""
							})) || []
					};
					schoolMap.set(school, info);
				})
			);

			// Person-level in parallel
			const results = await Promise.all(
				input.rows.map(async (r) => {
					const name = `${r.firstName} ${r.lastName}`.trim();
					const school = r.company || "Unknown";
					const schoolInfo = schoolMap.get(r.company || "") || {};
					const personContext = [
						`Person: ${name}`,
						r.title ? `Title: ${r.title}` : "",
						r.email ? `Email: ${r.email}` : "",
						r.city ? `City: ${r.city}` : "",
						r.state ? `State: ${r.state}` : "",
						`School/District: ${school}`,
						schoolInfo.districtWebsite ? `District Website: ${schoolInfo.districtWebsite}` : "",
						r.companyLinkedIn ? `School LinkedIn: ${r.companyLinkedIn}` : ""
					]
						.filter(Boolean)
						.join("\n- ");
					const personPrompt = [
						"Use web search to verify the individual's LinkedIn and summarize their background.",
						"Return ONLY JSON, no markdown:",
						JSON.stringify(
							{
								superintendentTenure: "<string>",
								personLinkedIn:
									"<the individual's personal LinkedIn profile URL if highly confident; otherwise 'Unknown'>",
								personProfileUrl:
									"<if LinkedIn is Unknown, return the individual's profile/biography page URL on the official district website; otherwise 'Unknown'>",
								noteworthyBackground:
									`<multi-sentence summary about ${name} as ${r.title || "the leader"} at ${school}>`
							},
							null,
							2
						),
						"",
						"Context:",
						`- ${personContext}`,
						"",
						"Fallback rule for profile URL:",
						"- If personLinkedIn is 'Unknown' but you can identify the district website, search for a staff/leadership page for this person on that site and return its URL as personProfileUrl.",
						"- Use a plain absolute URL string. Do NOT use markdown links or citations.",
						"",
						"Do NOT include citations or markdown links."
					].join("\n");

					const resp = await (client as any).responses.create({
						model,
						input: personPrompt,
						tools: [{ type: "web_search" }],
						tool_choice: "required"
					});
					let raw = resp?.output_text || "";
					if (raw.startsWith("```")) {
						raw = raw.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
					}
					let parsed: z.infer<typeof personSchema> | null = null;
					try {
						parsed = personSchema.parse(JSON.parse(raw));
					} catch {
						parsed = null;
					}

					return {
						schoolDistrictName: school,
						superintendentFullName: name,
						superintendentTitle: r.title || "Unknown",
						superintendentTenure: sanitizeText(parsed?.superintendentTenure) || "Unknown",
						intermediateSchoolDistrict:
							sanitizeText(schoolInfo.intermediateSchoolDistrict) || "Unknown",
						phoneNumber: r.workPhone || r.mobilePhone || r.homePhone || "Unknown",
						emailAddress: r.email || "Unknown",
						totalEnrollment: r.companySize || schoolInfo.totalEnrollment || "Unknown",
						ruralClassification: sanitizeText(schoolInfo.ruralClassification) || "Unknown",
						noteworthyBackground: sanitizeText(parsed?.noteworthyBackground) || "Unknown",
						districtWebsite: schoolInfo.districtWebsite || "Unknown",
						personLinkedIn: parsed?.personLinkedIn || "Unknown",
						personProfileUrl: parsed?.personProfileUrl || "Unknown",
						news: schoolInfo.news || []
					};
				})
			);

			return results;
		})
});

