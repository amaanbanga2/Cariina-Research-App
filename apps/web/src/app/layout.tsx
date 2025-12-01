export default function RootLayout(props: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					fontFamily: "ui-sans-serif, system-ui, sans-serif",
					background: "#f6f7f9",
					color: "#111827",
					WebkitFontSmoothing: "antialiased" as any,
					MozOsxFontSmoothing: "grayscale" as any
				}}
			>
				{props.children}
			</body>
		</html>
	);
}

