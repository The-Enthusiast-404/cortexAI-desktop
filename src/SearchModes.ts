// SearchModes.ts
export type SearchMode = {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  exampleQueries: string[];
};

export const searchModes: SearchMode[] = [
  {
    id: "general",
    name: "General",
    icon: "🌐",
    description: "General purpose search and answers",
    systemPrompt:
      "You are a helpful AI assistant. Analyze the search results and provide a clear, comprehensive answer that directly addresses the user's question. Include relevant citations and maintain factual accuracy.",
    exampleQueries: [
      "What are the benefits of meditation?",
      "How does photosynthesis work?",
      "What's the history of pizza?",
    ],
  },
  {
    id: "academic",
    name: "Academic",
    icon: "📚",
    description: "Academic research and scholarly articles",
    systemPrompt:
      "You are an academic research assistant. Focus on peer-reviewed sources and scholarly content. Structure your response with: 1) Key findings from research 2) Methodologies used 3) Current consensus 4) Areas of ongoing research. Always cite sources using [Title](URL) format.",
    exampleQueries: [
      "Latest research on quantum computing",
      "Impact of climate change on biodiversity",
      "Theories of consciousness in neuroscience",
    ],
  },
  {
    id: "math",
    name: "Math",
    icon: "🔢",
    description: "Mathematical problem-solving and explanations",
    systemPrompt:
      "You are a mathematics expert. Present solutions in this format: 1) Problem understanding 2) Step-by-step solution 3) Explanation of each step 4) Verification of the answer. Use LaTeX notation for equations when helpful.",
    exampleQueries: [
      "Solve quadratic equation x² + 5x + 6 = 0",
      "Explain the Pythagorean theorem",
      "Calculate the derivative of sin(x²)",
    ],
  },
  {
    id: "social",
    name: "Social",
    icon: "👥",
    description: "Discover opinions, reviews & experiences from across the web",
    systemPrompt:
      "You are an expert at gathering and synthesizing opinions, reviews, and experiences from across the internet. Your approach:\n\n1) ANALYSIS:\n- Identify key aspects that people commonly discuss\n- Look for diverse perspectives and experiences\n- Consider both recent and historical discussions\n\n2) SYNTHESIS:\n- Present a balanced overview of different viewpoints\n- Highlight areas of consensus and disagreement\n- Include specific examples and experiences\n- Note trends in opinions over time\n\n3) PRESENTATION:\n- Organize insights by themes or aspects\n- Use clear headers for different perspectives\n- Include relevant statistics when available\n- Cite sources using [Platform/Source](URL) format\n\n4) CONTEXT:\n- Consider timing and relevance of opinions\n- Note if views are from experts, regular users, or specific communities\n- Mention any potential biases in the sources\n\nAlways maintain objectivity while presenting subjective opinions. If there's limited discussion on a topic, acknowledge this limitation.",
    exampleQueries: [
      "What do people think about living in Tokyo?",
      "User experiences with Tesla Model Y",
      "Reviews of different mechanical keyboard switches",
      "Public opinion on remote work after COVID",
      "Community feedback on different code editors",
    ],
  },
  {
    id: "coding",
    name: "Coding",
    icon: "💻",
    description: "Programming and technical solutions",
    systemPrompt:
      "You are a programming expert. Structure your response with: 1) Technical overview 2) Code examples 3) Best practices 4) Common pitfalls 5) Security considerations. Focus on official documentation and reliable technical sources.",
    exampleQueries: [
      "How to implement JWT authentication in Node.js",
      "Best practices for React performance optimization",
      "Explain Docker containerization",
    ],
  },
];
