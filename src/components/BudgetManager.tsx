'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useReceipts } from '@/hooks/useReceipts';
import { BudgetingService, type Budget, type BudgetRecommendation } from '@/services/BudgetingService';
import {
  Plus,
  Edit3,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  Calendar,
  DollarSign,
  BarChart3,
  Lightbulb,
  Sparkles
} from 'lucide-react';

interface BudgetManagerProps {
  className?: string;
}

export function BudgetManager({ className }: BudgetManagerProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [recommendations, setRecommendations] = useState<BudgetRecommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [budgetingService, setBudgetingService] = useState<BudgetingService | null>(null);

  const { receipts, categories } = useReceipts();
  const { toast } = useToast();

  // Initialize budgeting service
  useEffect(() => {
    if (receipts.length > 0) {
      const service = new BudgetingService(receipts, budgets);
      setBudgetingService(service);
    }
  }, [receipts, budgets]);

  // Load budget recommendations
  const loadRecommendations = () => {
    if (budgetingService) {
      const recs = budgetingService.generateBudgetRecommendations();
      setRecommendations(recs);
      setShowRecommendations(true);
    }
  };

  const getBudgetPerformance = (budget: Budget) => {
    if (!budgetingService) return null;
    return budgetingService.getBudgetPerformance(budget.id);
  };

  const getStatusColor = (percentageUsed: number) => {
    if (percentageUsed >= 100) return 'text-red-600';
    if (percentageUsed >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (percentageUsed: number) => {
    if (percentageUsed >= 100) return 'bg-red-500';
    if (percentageUsed >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Budget Management</h2>
          <p className="text-gray-600">Create and monitor your spending budgets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadRecommendations}>
            <Lightbulb className="w-4 h-4 mr-2" />
            Get Recommendations
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Budget
          </Button>
        </div>
      </div>

      {/* Budget Recommendations */}
      {showRecommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Smart Budget Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendations.slice(0, 5).map((rec, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium capitalize">
                      {rec.category.replace('_', ' ')}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(rec.confidence * 100)}% confidence
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {rec.trend === 'increasing' && <TrendingUp className="w-3 h-3 text-red-500" />}
                      {rec.trend === 'decreasing' && <TrendingDown className="w-3 h-3 text-green-500" />}
                      {rec.trend === 'stable' && <BarChart3 className="w-3 h-3 text-blue-500" />}
                      {rec.trend}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{rec.reasoning}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">${rec.suggested_amount.toFixed(0)}</div>
                  <div className="text-xs text-gray-500">
                    vs ${rec.historical_average.toFixed(0)} avg
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(true);
                    // Pre-fill form with recommendation
                  }}
                >
                  Use
                </Button>
              </div>
            ))}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowRecommendations(false)}
              className="w-full"
            >
              Hide Recommendations
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.filter(b => b.is_active).map(budget => {
          const performance = getBudgetPerformance(budget);
          if (!performance) return null;

          return (
            <Card key={budget.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{budget.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingBudget(budget)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBudgets(prev => prev.filter(b => b.id !== budget.id));
                        toast({
                          title: "Budget Deleted",
                          description: `${budget.name} has been removed`,
                        });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="capitalize">{budget.period_type}</span>
                  <span>•</span>
                  <span className="capitalize">{budget.category.replace('_', ' ')}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Budget Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span className={getStatusColor(performance.percentageUsed)}>
                      {performance.percentageUsed.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, performance.percentageUsed)} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>${performance.currentSpent.toFixed(2)} spent</span>
                    <span>${budget.budget_amount.toFixed(2)} budget</span>
                  </div>
                </div>

                {/* Status Alert */}
                {performance.percentageUsed >= 100 && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      Budget exceeded by ${(performance.currentSpent - budget.budget_amount).toFixed(2)}
                    </AlertDescription>
                  </Alert>
                )}

                {performance.percentageUsed >= budget.alert_threshold && performance.percentageUsed < 100 && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      {budget.alert_threshold}% threshold reached
                    </AlertDescription>
                  </Alert>
                )}

                {performance.percentageUsed < budget.alert_threshold && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      On track with ${performance.remainingAmount.toFixed(2)} remaining
                    </AlertDescription>
                  </Alert>
                )}

                {/* Budget Metrics */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Days Left</div>
                    <div className="font-semibold">{performance.daysRemaining}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Daily Avg</div>
                    <div className="font-semibold">${performance.dailyAverageSpent.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Projected</div>
                    <div className={`font-semibold ${performance.onTrack ? 'text-green-600' : 'text-red-600'}`}>
                      ${performance.projectedTotal.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Status</div>
                    <div className={`font-semibold ${performance.onTrack ? 'text-green-600' : 'text-red-600'}`}>
                      {performance.onTrack ? 'On Track' : 'Over Budget'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Create Budget Card */}
        {!showCreateForm && (
          <Card className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-colors">
            <CardContent className="flex items-center justify-center h-full p-6">
              <Button
                variant="ghost"
                onClick={() => setShowCreateForm(true)}
                className="h-auto flex-col gap-2"
              >
                <Plus className="w-8 h-8 text-gray-400" />
                <span className="text-gray-600">Create New Budget</span>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Budget Form */}
      {(showCreateForm || editingBudget) && (
        <BudgetForm
          budget={editingBudget}
          categories={categories}
          recommendations={recommendations}
          onSave={(budget) => {
            if (editingBudget) {
              setBudgets(prev => prev.map(b => b.id === budget.id ? budget : b));
              setEditingBudget(null);
              toast({
                title: "Budget Updated",
                description: `${budget.name} has been updated successfully`,
              });
            } else {
              setBudgets(prev => [...prev, budget]);
              setShowCreateForm(false);
              toast({
                title: "Budget Created",
                description: `${budget.name} has been created successfully`,
              });
            }
          }}
          onCancel={() => {
            setShowCreateForm(false);
            setEditingBudget(null);
          }}
        />
      )}
    </div>
  );
}

interface BudgetFormProps {
  budget?: Budget | null;
  categories: any[];
  recommendations: BudgetRecommendation[];
  onSave: (budget: Budget) => void;
  onCancel: () => void;
}

function BudgetForm({ budget, categories, recommendations, onSave, onCancel }: BudgetFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    period_type: 'monthly' as Budget['period_type'],
    budget_amount: '',
    alert_threshold: '80',
    auto_rollover: false,
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (budget) {
      setFormData({
        name: budget.name,
        category: budget.category,
        period_type: budget.period_type,
        budget_amount: budget.budget_amount.toString(),
        alert_threshold: budget.alert_threshold.toString(),
        auto_rollover: budget.auto_rollover,
        start_date: budget.start_date.split('T')[0],
        end_date: budget.end_date.split('T')[0],
      });
    } else {
      // Set default dates based on period type
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      setFormData(prev => ({
        ...prev,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      }));
    }
  }, [budget]);

  const handlePeriodTypeChange = (periodType: Budget['period_type']) => {
    const now = new Date();
    let startDate: Date, endDate: Date;

    switch (periodType) {
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date();
        endDate = new Date();
    }

    setFormData(prev => ({
      ...prev,
      period_type: periodType,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newBudget: Budget = {
      id: budget?.id || Math.random().toString(36).substr(2, 9),
      user_id: 'current_user', // Will be replaced with actual user ID
      name: formData.name,
      category: formData.category,
      period_type: formData.period_type,
      budget_amount: parseFloat(formData.budget_amount),
      current_spent: budget?.current_spent || 0,
      start_date: formData.start_date,
      end_date: formData.end_date,
      alert_threshold: parseInt(formData.alert_threshold),
      is_active: true,
      auto_rollover: formData.auto_rollover,
      created_at: budget?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(newBudget);
  };

  const applyRecommendation = (rec: BudgetRecommendation) => {
    setFormData(prev => ({
      ...prev,
      name: `${rec.category.replace('_', ' ')} Budget`,
      category: rec.category,
      budget_amount: rec.suggested_amount.toString(),
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {budget ? 'Edit Budget' : 'Create New Budget'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Budget Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Monthly Food Budget"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name.toLowerCase().replace(/\s+/g, '_')}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_type">Period Type</Label>
              <Select 
                value={formData.period_type} 
                onValueChange={handlePeriodTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_amount">Budget Amount</Label>
              <Input
                id="budget_amount"
                type="number"
                step="0.01"
                value={formData.budget_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, budget_amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert_threshold">Alert Threshold (%)</Label>
              <Select 
                value={formData.alert_threshold} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, alert_threshold: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="75">75%</SelectItem>
                  <SelectItem value="80">80%</SelectItem>
                  <SelectItem value="90">90%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="auto_rollover"
                checked={formData.auto_rollover}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_rollover: checked }))}
              />
              <Label htmlFor="auto_rollover">Auto-rollover unused budget</Label>
            </div>
          </div>

          {/* Quick Apply Recommendations */}
          {!budget && recommendations.length > 0 && (
            <div className="space-y-2">
              <Label>Quick Apply Recommendations</Label>
              <div className="flex flex-wrap gap-2">
                {recommendations.slice(0, 3).map((rec, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyRecommendation(rec)}
                  >
                    <Target className="w-3 h-3 mr-1" />
                    {rec.category.replace('_', ' ')}: ${rec.suggested_amount.toFixed(0)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {budget ? 'Update Budget' : 'Create Budget'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}