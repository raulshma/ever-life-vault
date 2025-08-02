import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  BookOpen, 
  FileText,
  Tag,
  Clock,
  Star,
  Edit3,
  Loader2
} from 'lucide-react';
import { useNotes } from '@/hooks/useNotes';

const tagColors = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800'
];

export default function KnowledgeBase() {
  const { notes, loading, addNote, toggleFavorite } = useNotes();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAllTags = () => {
    const allTags = notes.flatMap(note => note.tags);
    return [...new Set(allTags)];
  };

  const createNote = async () => {
    if (!newNote.title.trim()) return;

    const tags = newNote.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    const createdNote = await addNote(newNote.title, newNote.content, tags);
    
    if (createdNote) {
      setNewNote({ title: '', content: '', tags: '' });
      setIsCreating(false);
      setSelectedNote(createdNote);
    }
  };

  const handleToggleFavorite = (noteId: string) => {
    toggleFavorite(noteId);
    if (selectedNote?.id === noteId) {
      setSelectedNote({ ...selectedNote, is_favorite: !selectedNote.is_favorite });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-gradient-primary text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
              <p className="text-white/90">Store and organize your research and notes</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <span className="text-sm text-white/90">{notes.length} notes</span>
              </div>
              <Button 
                variant="hero" 
                onClick={() => setIsCreating(true)}
                className="bg-white/20 hover:bg-white/30"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Note
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Notes List */}
          <div className="lg:col-span-1 space-y-6">
            {/* Search */}
            <Card className="bg-gradient-card shadow-card">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Tag className="w-4 h-4 mr-2" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {getAllTags().map((tag, index) => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className={`cursor-pointer ${tagColors[index % tagColors.length]}`}
                      onClick={() => setSearchTerm(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes List */}
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <Card 
                  key={note.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-card ${
                    selectedNote?.id === note.id ? 'ring-2 ring-primary shadow-elegant' : ''
                  }`}
                  onClick={() => setSelectedNote(note)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-foreground line-clamp-1">{note.title}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${note.is_favorite ? 'text-yellow-500' : 'text-muted-foreground'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(note.id);
                        }}
                      >
                        <Star className={`w-4 h-4 ${note.is_favorite ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(note.updated_at).toLocaleDateString()}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {note.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {note.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{note.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Note Editor/Viewer */}
          <div className="lg:col-span-2">
            {isCreating ? (
              <Card className="bg-gradient-card shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Edit3 className="w-5 h-5 mr-2" />
                      Create New Note
                    </span>
                    <Button variant="ghost" onClick={() => setIsCreating(false)}>
                      Cancel
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Note title..."
                    value={newNote.title}
                    onChange={(e) => setNewNote({...newNote, title: e.target.value})}
                  />
                  <Textarea
                    placeholder="Start writing your note..."
                    value={newNote.content}
                    onChange={(e) => setNewNote({...newNote, content: e.target.value})}
                    rows={12}
                  />
                  <Input
                    placeholder="Tags (comma separated)..."
                    value={newNote.tags}
                    onChange={(e) => setNewNote({...newNote, tags: e.target.value})}
                  />
                  <div className="flex space-x-3">
                    <Button onClick={createNote} variant="default">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Note
                    </Button>
                    <Button variant="ghost" onClick={() => setIsCreating(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : selectedNote ? (
              <Card className="bg-gradient-card shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      {selectedNote.title}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={selectedNote.is_favorite ? 'text-yellow-500' : 'text-muted-foreground'}
                      onClick={() => handleToggleFavorite(selectedNote.id)}
                    >
                      <Star className={`w-5 h-5 ${selectedNote.is_favorite ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Created {new Date(selectedNote.created_at).toLocaleDateString()}</span>
                    <span>Updated {new Date(selectedNote.updated_at).toLocaleDateString()}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap text-foreground">
                      {selectedNote.content}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {selectedNote.tags.map((tag, index) => (
                      <Badge 
                        key={tag} 
                        variant="secondary"
                        className={tagColors[index % tagColors.length]}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-card shadow-card">
                <CardContent className="p-12 text-center">
                  <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Select a note to view
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Choose a note from the list or create a new one to get started
                  </p>
                  <Button variant="default" onClick={() => setIsCreating(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Note
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}