"use client";

import React from "react";
import { trpc } from "../../trpc/client";
import { useRouter } from "next/navigation";

type FilteredRow = {
	"First Name": string;
	"Last Name": string;
	Email?: string;
	"Mobile Phone"?: string;
	"Work Phone"?: string;
	"Home Phone"?: string;
	City?: string;
	State?: string;
	Title?: string;
	Company?: string;
	"Company Size"?: string;
	"Company LinkedIn"?: string;
};

type ResearchResult = {
	schoolDistrictName: string;
	superintendentFullName: string;
	superintendentTitle: string;
	superintendentTenure: string;
	intermediateSchoolDistrict: string;
	phoneNumber: string;
	emailAddress: string;
	totalEnrollment: string;
	ruralClassification: string;
	noteworthyBackground: string;
	districtWebsite: string;
	personLinkedIn: string;
	personProfileUrl: string;
	news: { title: string; url: string; summary: string }[];
};

export default function ResultsInner() {
	const [error, setError] = React.useState<string>("");
	const [rows, setRows] = React.useState<FilteredRow[] | null>(null);
	const [results, setResults] = React.useState<ResearchResult[]>([]);
	const [currentIndex, setCurrentIndex] = React.useState<number>(0);
	const [loading, setLoading] = React.useState<boolean>(false);
	const batch = trpc.research.batch.useMutation();
	const router = useRouter();

	function toAnchorId(name: string, idx: number) {
		const base = (name || "person")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
		return `person-${idx}-${base}`;
	}

	React.useEffect(() => {
		try {
			const raw = sessionStorage.getItem("uploadedRows");
			if (!raw) {
				setError("No uploaded data found. Please upload a CSV first.");
				return;
			}
			const parsed = JSON.parse(raw) as FilteredRow[];
			setRows(parsed);
		} catch {
			setError("Failed to read uploaded data. Please upload again.");
		}
	}, []);

	React.useEffect(() => {
		async function run() {
			if (!rows || rows.length === 0) return;
			setError("");
			setResults([]);
			const toProcess = rows;
			setLoading(true);
			setCurrentIndex(toProcess.length);
			try {
				const settled = await batch.mutateAsync({
					rows: toProcess.map((r) => ({
						firstName: r["First Name"],
						lastName: r["Last Name"],
						email: r.Email,
						mobilePhone: r["Mobile Phone"],
						workPhone: r["Work Phone"],
						homePhone: r["Home Phone"],
						city: r.City,
						state: r.State,
						title: r.Title,
						company: r.Company,
						companySize: r["Company Size"],
						companyLinkedIn: r["Company LinkedIn"]
					}))
				});
				setResults(settled as unknown as ResearchResult[]);
			} catch (e: any) {
				setError(e?.message || "Batch request failed.");
			}
			setLoading(false);
		}
		void run();
	}, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div style={{ padding: 24 }}>
			<header
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 16
				}}
			>
				<h1 style={{ fontSize: 28, margin: 0 }}>Cariina Research App</h1>
				<div style={{ color: "#6b7280", fontSize: 13 }}>
					{results.length > 0 ? `${results.length} results` : null}
				</div>
			</header>
			<div style={{ marginBottom: 12 }}>
				<button
					onClick={() => {
						try {
							sessionStorage.removeItem("uploadedRows");
						} catch {}
						router.push("/upload");
					}}
					style={{
						padding: "8px 12px",
						borderRadius: 8,
						border: "1px solid #d1d5db",
						background: "#ffffff",
						cursor: "pointer"
					}}
				>
					Upload another CSV
				</button>
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: results.length > 0 ? "260px 1fr" : "1fr",
					alignItems: "start",
					gap: 16
				}}
			>
				{/* Left: TOC */}
				{results.length > 0 ? (
					<nav
						aria-label="People"
						style={{
							position: "sticky",
							top: 16,
							alignSelf: "start",
							border: "1px solid #e5e7eb",
							borderRadius: 10,
							padding: 12,
							background: "#ffffff",
							boxShadow:
								"0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
							maxHeight: "80vh",
							overflow: "auto"
						}}
					>
						<div style={{ fontWeight: 700, marginBottom: 8, color: "#374151" }}>
							People
						</div>
						<ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
							{results.map((r, idx) => {
								const id = toAnchorId(r.superintendentFullName, idx);
								return (
									<li key={id} style={{ marginBottom: 6 }}>
										<a
											href={`#${id}`}
											style={{
												color: "#1d4ed8",
												textDecoration: "none",
												display: "block",
												padding: "6px 8px",
												borderRadius: 8
											}}
											onMouseOver={(e) =>
												((e.currentTarget as HTMLAnchorElement).style.backgroundColor =
													"#f3f4f6")
											}
											onMouseOut={(e) =>
												((e.currentTarget as HTMLAnchorElement).style.backgroundColor =
													"transparent")
											}
										>
											{idx + 1}. {r.superintendentFullName}
											{r.schoolDistrictName ? ` — ${r.schoolDistrictName}` : ""}
										</a>
									</li>
								);
							})}
						</ul>
					</nav>
				) : null}

				{/* Right: Content */}
				<div>
					{rows ? (
						<p style={{ color: "#6b7280", marginBottom: 16 }}>
							{loading
								? `Processing ${rows.length} in parallel...`
								: `Completed ${results.length}/${rows.length}`}
						</p>
					) : null}
					{error ? <div style={{ color: "#b00020" }}>{error}</div> : null}
					<div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
						{results.map((r, idx) => {
							const id = toAnchorId(r.superintendentFullName, idx);
							return (
								<div
									id={id}
									key={id}
									style={{
										border: "1px solid #e5e7eb",
										borderRadius: 10,
										padding: 16,
										background: "#ffffff",
										boxShadow:
											"0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)"
									}}
								>
						<div style={{ margin: "0 0 8px 0" }}>
							<div
								style={{
									fontSize: 18,
									fontWeight: 700,
									color: "#111827",
									marginBottom: 4
								}}
							>
								{idx + 1}. {r.superintendentFullName || "Unknown"}
							</div>
							<div style={{ color: "#4b5563" }}>
								{r.superintendentTitle || "Unknown"} —{" "}
								<strong>{r.schoolDistrictName || "Unknown"}</strong>
							</div>
						</div>
						<hr style={{ border: 0, borderTop: "1px solid #eef2f7", margin: "8px 0" }} />

						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
							<section>
								<h3
									style={{
										margin: "8px 0",
										fontSize: 12,
										color: "#6b7280",
										letterSpacing: 0.3,
										textTransform: "uppercase"
									}}
								>
									Superintendent
								</h3>
								<div style={{ lineHeight: 1.6 }}>
									<div>
										<strong>Name/Title:</strong> {r.superintendentFullName} — {r.superintendentTitle}
									</div>
									<div>
										<strong>Tenure:</strong> {r.superintendentTenure}
									</div>
									<div>
										<strong>Intermediate School District:</strong> {r.intermediateSchoolDistrict}
									</div>
								</div>
							</section>

							<section>
								<h3
									style={{
										margin: "8px 0",
										fontSize: 12,
										color: "#6b7280",
										letterSpacing: 0.3,
										textTransform: "uppercase"
									}}
								>
									Contact
								</h3>
								<div style={{ lineHeight: 1.6 }}>
									<div>
										<strong>Phone:</strong> {r.phoneNumber}
									</div>
									<div>
										<strong>Email:</strong> {r.emailAddress}
									</div>
								</div>
							</section>

							<section>
								<h3
									style={{
										margin: "8px 0",
										fontSize: 12,
										color: "#6b7280",
										letterSpacing: 0.3,
										textTransform: "uppercase"
									}}
								>
									Enrollment & Classification
								</h3>
								<div style={{ lineHeight: 1.6 }}>
									<div>
										<strong>Total Enrollment:</strong> {r.totalEnrollment}
									</div>
									<div>
										<strong>Rural Classification:</strong> {r.ruralClassification}
									</div>
								</div>
							</section>

							<section>
								<h3
									style={{
										margin: "8px 0",
										fontSize: 12,
										color: "#6b7280",
										letterSpacing: 0.3,
										textTransform: "uppercase"
									}}
								>
									Web & Profile
								</h3>
								<div style={{ lineHeight: 1.6 }}>
									<div>
										<strong>District Website:</strong>{" "}
										{r.districtWebsite && r.districtWebsite !== "Unknown" ? (
											<a href={r.districtWebsite} target="_blank" rel="noreferrer">
												{r.districtWebsite}
											</a>
										) : (
											"Unknown"
										)}
									</div>
									<div>
										<strong>Superintendent Profile:</strong>{" "}
										{r.personLinkedIn && r.personLinkedIn !== "Unknown" ? (
											<a href={r.personLinkedIn} target="_blank" rel="noreferrer">
												{r.personLinkedIn}
											</a>
										) : r.personProfileUrl && r.personProfileUrl !== "Unknown" ? (
											<a href={r.personProfileUrl} target="_blank" rel="noreferrer">
												{r.personProfileUrl}
											</a>
										) : (
											"Unknown"
										)}
									</div>
								</div>
							</section>
						</div>

						<section style={{ marginTop: 12 }}>
							<h3
								style={{
									margin: "8px 0",
									fontSize: 12,
									color: "#6b7280",
									letterSpacing: 0.3,
									textTransform: "uppercase"
								}}
							>
								Noteworthy Background
							</h3>
							<div style={{ lineHeight: 1.6 }}>{r.noteworthyBackground}</div>
						</section>

						<section style={{ marginTop: 12 }}>
							<h3
								style={{
									margin: "8px 0",
									fontSize: 12,
									color: "#6b7280",
									letterSpacing: 0.3,
									textTransform: "uppercase"
								}}
							>
								Notable News (last 12 months)
							</h3>
							{Array.isArray(r.news) && r.news.length > 0 ? (
								<ul style={{ margin: 0, paddingLeft: 18 }}>
									{r.news.map((n, i) => (
										<li key={i} style={{ marginBottom: 6 }}>
											<div style={{ fontWeight: 600 }}>{n.title}</div>
											<div style={{ color: "#444" }}>{n.summary}</div>
											{n.url ? (
												<div>
													<a href={n.url} target="_blank" rel="noreferrer">
														{n.url}
													</a>
												</div>
											) : null}
										</li>
									))}
								</ul>
							) : (
								<div style={{ color: "#777" }}>No notable items.</div>
							)}
						</section>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}


