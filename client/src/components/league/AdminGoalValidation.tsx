import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Match, StatReport } from '@shared/schema';

interface AdminGoalValidationProps {
  match: Match;
  statReports: StatReport[];
  user: any;
}

interface ValidationResult {
  isValid: boolean;
  reportedTotal: number;
  difference: number;
}

export default function AdminGoalValidation({ match, statReports, user }: AdminGoalValidationProps) {
  const [finalScore, setFinalScore] = useState<number>(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only show to admin
  if (!user || user.role !== 'admin') {
    return null;
  }

  const reportedTotal = statReports.reduce((sum, report) => sum + (report.goals || 0), 0);

  const validateGoalsMutation = useMutation({
    mutationFn: async (data: { finalScore: number }) => {
      const response = await apiRequest('POST', `/api/matches/${match.id}/validate-goals`, data);
      return response.json();
    },
    onSuccess: (result: ValidationResult) => {
      setValidationResult(result);
      if (result.isValid) {
        toast({
          title: "Goals Validated",
          description: "Reported goals match the final score!",
        });
      } else {
        toast({
          title: "Goal Mismatch",
          description: `Difference of ${Math.abs(result.difference)} goals detected`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Validation Error",
        description: error.message || "Failed to validate goals",
        variant: "destructive",
      });
    }
  });

  const handleValidate = () => {
    if (finalScore < 0) {
      toast({
        title: "Invalid Score",
        description: "Final score cannot be negative",
        variant: "destructive",
      });
      return;
    }
    validateGoalsMutation.mutate({ finalScore });
  };

  return (
    <Card className="bg-[#1e1e1e] border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Admin Goal Validation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-[#2a2a2a] rounded-lg">
            <div className="text-sm text-gray-400">Reported Goals</div>
            <div className="text-2xl font-bold text-white">{reportedTotal}</div>
            <div className="text-xs text-gray-500">{statReports.length} players reported</div>
          </div>
          <div className="text-center p-3 bg-[#2a2a2a] rounded-lg">
            <div className="text-sm text-gray-400">Final Score</div>
            <div className="text-2xl font-bold text-blue-400">{finalScore || '—'}</div>
            <div className="text-xs text-gray-500">Enter actual total</div>
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-2">
          <Label htmlFor="finalScore" className="text-white">Enter Final Match Score</Label>
          <div className="flex gap-2">
            <Input
              id="finalScore"
              type="number"
              min="0"
              value={finalScore}
              onChange={(e) => setFinalScore(parseInt(e.target.value) || 0)}
              placeholder="Total goals scored in match"
              className="bg-[#2a2a2a] border-gray-600 text-white"
            />
            <Button 
              onClick={handleValidate}
              disabled={validateGoalsMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {validateGoalsMutation.isPending ? 'Validating...' : 'Validate'}
            </Button>
          </div>
        </div>

        {/* Validation Result */}
        {validationResult && (
          <Alert className={validationResult.isValid ? "border-green-600 bg-green-950" : "border-red-600 bg-red-950"}>
            <div className="flex items-center gap-2">
              {validationResult.isValid ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              )}
              <AlertDescription className={validationResult.isValid ? "text-green-200" : "text-red-200"}>
                {validationResult.isValid ? (
                  "Goals validated successfully! Reported total matches final score."
                ) : (
                  <>
                    Goal mismatch detected: Reported {validationResult.reportedTotal} vs Final {finalScore}.
                    Difference: {validationResult.difference > 0 ? `+${validationResult.difference}` : validationResult.difference} goals.
                  </>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Quick Stats */}
        <div className="pt-2 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Player Reports Summary:</div>
          <div className="flex flex-wrap gap-1">
            {statReports.map((report, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {report.goals || 0}g {report.assists || 0}a
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}