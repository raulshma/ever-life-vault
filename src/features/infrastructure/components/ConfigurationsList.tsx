import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Pencil, Trash2, RefreshCcw } from "lucide-react";
import type { DockerComposeConfig } from "../types";
import { configsApi } from "../services/configsApi";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

interface ConfigurationsListProps {
	onEdit: (config: DockerComposeConfig) => void;
}

export const ConfigurationsList: React.FC<ConfigurationsListProps> = ({ onEdit }) => {
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ["docker-configs"],
		queryFn: () => configsApi.list(),
		staleTime: 30_000,
	});

	const configs = data ?? [];

	const deleteMutation = useMutation({
		mutationFn: (id: string) => configsApi.remove(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["docker-configs"] });
			toast({ title: "Deleted", description: "Configuration deleted." });
		},
		onError: (e: unknown) => {
			const msg = e instanceof Error ? e.message : String(e);
			toast({ title: "Failed to delete", description: msg, variant: "destructive" });
		},
	});

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div className="flex items-center gap-2">
					<Settings className="h-4 w-4" />
					<CardTitle>Saved Configurations</CardTitle>
				</div>
				<Button variant="outline" size="sm" onClick={() => { void refetch(); }} className="flex items-center gap-2">
					<RefreshCcw className="h-4 w-4" />
					Refresh
				</Button>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="text-sm text-muted-foreground">Loading...</div>
				) : isError ? (
					<div className="text-sm text-destructive">Failed to load configurations.</div>
				) : configs.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						<Settings className="h-10 w-10 mx-auto mb-3 opacity-50" />
						<div className="font-medium">No configurations yet</div>
						<div className="text-sm">Create your first Docker Compose configuration.</div>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
						{configs.map((cfg) => (
							<div key={cfg.id} className="border rounded-md p-4">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="font-medium truncate">{cfg.name}</div>
										<div className="text-xs text-muted-foreground truncate">{cfg.description || ""}</div>
									</div>
									<div className="flex items-center gap-2 flex-shrink-0">
										<Button variant="outline" size="sm" onClick={() => onEdit(cfg)} className="h-8 px-2">
											<Pencil className="h-4 w-4" />
										</Button>
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	variant="outline"
																	size="sm"
																	className="h-8 px-2"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>Delete configuration?</AlertDialogTitle>
																	<AlertDialogDescription>
																		This will permanently remove "{cfg.name}". This action cannot be undone.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>Cancel</AlertDialogCancel>
																	<AlertDialogAction
																		onClick={() => deleteMutation.mutate(cfg.id)}
																	>
																		Delete
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
									</div>
								</div>
								<div className="mt-3 text-xs text-muted-foreground">
									Updated {new Date(cfg.updated_at).toLocaleString()}
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
};


