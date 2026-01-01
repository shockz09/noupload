export interface GradientPreset {
	name: string;
	css: string;
}

export const gradientPresets: GradientPreset[] = [
	// Warm
	{ name: "Sunset", css: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
	{ name: "Flare", css: "linear-gradient(135deg, #f12711 0%, #f5af19 100%)" },
	{
		name: "Warm Flame",
		css: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
	},

	// Cool
	{ name: "Ocean", css: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
	{ name: "Frost", css: "linear-gradient(135deg, #e0e5ec 0%, #c9d6e3 100%)" },
	{
		name: "Cool Blues",
		css: "linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)",
	},

	// Nature
	{ name: "Grass", css: "linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)" },
	{ name: "Lush", css: "linear-gradient(135deg, #43cea2 0%, #185a9d 100%)" },

	// Dark/Professional
	{
		name: "Midnight",
		css: "linear-gradient(135deg, #232526 0%, #414345 100%)",
	},
	{
		name: "Charcoal",
		css: "linear-gradient(135deg, #373b44 0%, #4286f4 100%)",
	},
	{ name: "Royal", css: "linear-gradient(135deg, #141e30 0%, #243b55 100%)" },

	// Vibrant
	{ name: "Candy", css: "linear-gradient(135deg, #d53369 0%, #daae51 100%)" },
	{ name: "Sublime", css: "linear-gradient(135deg, #fc466b 0%, #3f5efb 100%)" },
];

export const solidPresets: GradientPreset[] = [
	{ name: "White", css: "#ffffff" },
	{ name: "Light", css: "#f5f5f5" },
	{ name: "Gray", css: "#e5e5e5" },
	{ name: "Dark", css: "#1a1a1a" },
	{ name: "Blue", css: "#3b82f6" },
	{ name: "Purple", css: "#8b5cf6" },
];
