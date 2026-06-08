import type {
  AIOfficeConnection,
  AIOfficeNode,
} from "@/lib/ai-office/aiOfficeTypes";

type AIAgentConnectionProps = {
  connection: AIOfficeConnection;
  fromNode: AIOfficeNode;
  toNode: AIOfficeNode;
};

export function AIAgentConnection({
  connection,
  fromNode,
  toNode,
}: AIAgentConnectionProps) {
  const isCollaboration = connection.kind === "collaboration";
  const color = isCollaboration ? "#f97316" : "#2563eb";
  const markerId = `arrow-${connection.id}`;
  const midY = (fromNode.y + toNode.y) / 2;
  const curve =
    connection.kind === "supervision"
      ? `M ${fromNode.x} ${fromNode.y} C ${fromNode.x} ${midY}, ${toNode.x} ${midY}, ${toNode.x} ${toNode.y}`
      : `M ${fromNode.x} ${fromNode.y} C ${fromNode.x} ${fromNode.y - 10}, ${toNode.x} ${toNode.y - 10}, ${toNode.x} ${toNode.y}`;

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="7"
          refY="4"
          viewBox="0 0 8 8"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" fill={color} />
        </marker>
      </defs>
      <path
        d={curve}
        fill="none"
        stroke={color}
        strokeWidth={isCollaboration ? 3 : 2}
        strokeLinecap="round"
        strokeDasharray={isCollaboration ? "7 7" : "0"}
        markerEnd={`url(#${markerId})`}
        opacity={isCollaboration ? 0.9 : 0.82}
      />
      <circle
        cx={toNode.x}
        cy={toNode.y}
        r="4"
        fill={color}
      />
    </g>
  );
}
