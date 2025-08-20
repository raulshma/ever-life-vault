import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const SimpleYamlPreview: React.FC<{ content: string }> = ({ content }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
          <code>
            {content}
          </code>
        </pre>
      </CardContent>
    </Card>
  )
}

export default SimpleYamlPreview
