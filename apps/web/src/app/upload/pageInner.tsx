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
	const [parsing, setParsing] = React.useState<boolean>(false);
	const inputRef = React.useRef<HTMLInputElement | null>(null);
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
		setParsing(true);
		Papa.parse<RawRow>(file, {
			header: true,
			skipEmptyLines: true,
			worker: true,
			complete: (res) => {
				const filtered = (res.data || [])
					.map(filterRow)
					.filter((r): r is FilteredRow => !!r);
				if (filtered.length === 0) {
					setError("No valid rows found (need First Name and Last Name).");
					setParsing(false);
					return;
				}
				// Store rows for the results page to consume
				try {
					sessionStorage.setItem("uploadedRows", JSON.stringify(filtered));
				} catch (e) {
					setError("Unable to store data in session. Please close some tabs and retry.");
					setParsing(false);
					return;
				}
				setParsing(false);
				router.push("/results");
			},
			error: (err) => {
				setError(`Failed to parse CSV: ${err.message}`);
				setParsing(false);
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
						background: parsing ? "#eee" : "white",
						cursor: parsing ? "not-allowed" : "pointer",
						fontWeight: 600
					}}
				>
					{parsing ? "Parsing..." : "Upload CSV"}
				</label>
				<input
					id="csv-input"
					type="file"
					accept=".csv,text/csv"
					ref={inputRef}
					onClick={(e) => {
						// Allow selecting the same file twice by clearing the value
						(e.currentTarget as HTMLInputElement).value = "";
					}}
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


