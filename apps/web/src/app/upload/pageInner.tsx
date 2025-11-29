"use client";

import Papa from "papaparse";
import React from "react";
import { trpc } from "../../trpc/client";
import { useRouter } from "next/navigation";

type RawRow = Record<string, string | undefined>;

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

const REQUIRED_COLUMNS = [
	"First Name",
	"Last Name",
	"Email",
	"Mobile Phone",
	"Work Phone",
	"Home Phone",
	"City",
	"State",
	"Title",
	"Company",
	"Company Size",
	"Company LinkedIn"
] as const;

export default function UploadInner() {
	const [error, setError] = React.useState<string>("");
	const router = useRouter();

	function filterRow(raw: RawRow): FilteredRow | null {
		const first = (raw["First Name"] || "").trim();
		const last = (raw["Last Name"] || "").trim();
		if (!first || !last) return null;
		const filtered: Partial<FilteredRow> = {
			"First Name": first,
			"Last Name": last
		};
		for (const key of REQUIRED_COLUMNS) {
			if (key === "First Name" || key === "Last Name") continue;
			const value = (raw[key] || "").toString().trim();
			if (value) {
				(filtered as any)[key] = value;
			}
		}
		return filtered as FilteredRow;
	}

	function handleFile(file: File) {
		setError("");
		Papa.parse<RawRow>(file, {
			header: true,
			skipEmptyLines: true,
			complete: (res) => {
				const filtered = (res.data || [])
					.map(filterRow)
					.filter((r): r is FilteredRow => !!r);
				if (filtered.length === 0) {
					setError("No valid rows found (need First Name and Last Name).");
					return;
				}
				// Store rows for the results page to consume
				try {
					sessionStorage.setItem("uploadedRows", JSON.stringify(filtered));
				} catch {
					// ignore quota errors
				}
				router.push("/results");
			},
			error: (err) => {
				setError(`Failed to parse CSV: ${err.message}`);
			}
		});
	}

	return (
		<div style={{ padding: 24, maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
			<h1 style={{ fontSize: 28, marginBottom: 8 }}>Cariina Research App</h1>
			<p style={{ color: "#666", marginBottom: 24 }}>
				Upload a CSV from your CRM to begin.
			</p>
			<div>
				<label
					htmlFor="csv-input"
					style={{
						display: "inline-block",
						padding: "12px 18px",
						borderRadius: 10,
						border: "1px solid #ccc",
						background: "white",
						cursor: "pointer",
						fontWeight: 600
					}}
				>
					Upload CSV
				</label>
				<input
					id="csv-input"
					type="file"
					accept=".csv,text/csv"
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (f) handleFile(f);
					}}
					style={{ display: "none" }}
				/>
			</div>
			{error ? <div style={{ marginTop: 16, color: "#b00020" }}>{error}</div> : null}
			<div style={{ marginTop: 24, color: "#777", fontSize: 12 }}>
				Accepted columns: {REQUIRED_COLUMNS.join(", ")}
			</div>
		</div>
	);
}


