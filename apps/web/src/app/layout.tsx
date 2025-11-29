export default function RootLayout(props: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
				{props.children}
			</body>
		</html>
	);
}

